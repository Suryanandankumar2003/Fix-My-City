from datetime import datetime, timedelta, timezone
from pathlib import Path
import os
import shutil
import uuid

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import create_engine, String, Text, DateTime, ForeignKey, Integer, Float, func, text as sql_text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker, Session
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "sqlite:///./fixmycity.db"
    secret_key: str = "development-only-change-me"
    access_token_expire_minutes: int = 1440
    frontend_origin: str = "http://localhost:5173"
    upload_dir: str = "uploads"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="citizen")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    issues: Mapped[list["Issue"]] = relationship(back_populates="reporter")

class Department(Base):
    __tablename__ = "departments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str] = mapped_column(String(255), default="")
    issues: Mapped[list["Issue"]] = relationship(back_populates="department")

class Issue(Base):
    __tablename__ = "issues"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(50), index=True)
    location: Mapped[str] = mapped_column(String(255), index=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="Submitted", index=True)
    priority: Mapped[str] = mapped_column(String(20), default="Medium", index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    reporter: Mapped[User] = relationship(back_populates="issues")
    department: Mapped[Department | None] = relationship(back_populates="issues")
    updates: Mapped[list["IssueUpdate"]] = relationship(back_populates="issue", cascade="all, delete-orphan", order_by="IssueUpdate.created_at")

class IssueUpdate(Base):
    __tablename__ = "issue_updates"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    issue_id: Mapped[int] = mapped_column(ForeignKey("issues.id"))
    status: Mapped[str] = mapped_column(String(30))
    comment: Mapped[str] = mapped_column(Text, default="")
    updated_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    issue: Mapped[Issue] = relationship(back_populates="updates")

Base.metadata.create_all(bind=engine)
# Lightweight migration for existing SQLite databases created before map support.
if settings.database_url.startswith("sqlite"):
    with engine.begin() as connection:
        existing_columns = {row[1] for row in connection.execute(sql_text("PRAGMA table_info(issues)")).fetchall()}
        if "latitude" not in existing_columns:
            connection.execute(sql_text("ALTER TABLE issues ADD COLUMN latitude FLOAT"))
        if "longitude" not in existing_columns:
            connection.execute(sql_text("ALTER TABLE issues ADD COLUMN longitude FLOAT"))
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
app = FastAPI(title="FixMyCity API", version="1.0.0", description="Civic issue reporting and tracking API")
app.add_middleware(CORSMiddleware, allow_origins=[settings.frontend_origin, "http://127.0.0.1:5173"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

STATUSES = ["Submitted", "Under Review", "In Progress", "Resolved", "Rejected"]
PRIORITIES = ["Low", "Medium", "High", "Urgent"]
CATEGORIES = ["Roads & Potholes", "Garbage", "Streetlights", "Water & Drainage", "Public Infrastructure", "Other"]

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def user_out(user: User):
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role, "created_at": user.created_at}

def issue_out(issue: Issue):
    return {
        "id": issue.id, "title": issue.title, "description": issue.description,
        "category": issue.category, "location": issue.location, "latitude": issue.latitude, "longitude": issue.longitude, "image_path": issue.image_path,
        "status": issue.status, "priority": issue.priority, "user_id": issue.user_id,
        "reporter_name": issue.reporter.name if issue.reporter else None,
        "department_id": issue.department_id,
        "department_name": issue.department.name if issue.department else None,
        "created_at": issue.created_at, "updated_at": issue.updated_at,
        "updates": [{"id": u.id, "status": u.status, "comment": u.comment, "created_at": u.created_at} for u in issue.updates]
    }

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_error = HTTPException(status_code=401, detail="Invalid or expired access token", headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_error
    except JWTError:
        raise credentials_error
    user = db.get(User, int(user_id))
    if not user:
        raise credentials_error
    return user

def require_admin(user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Administrator access required")
    return user

class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class IssueCreate(BaseModel):
    title: str = Field(min_length=5, max_length=160)
    description: str = Field(min_length=10, max_length=5000)
    category: str
    location: str = Field(min_length=3, max_length=255)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

class IssueUpdateIn(BaseModel):
    status: str | None = None
    priority: str | None = None
    department_id: int | None = None
    comment: str = Field(default="", max_length=2000)

class DepartmentIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str = Field(default="", max_length=255)

@app.get("/")
def root():
    return {"name": "FixMyCity API", "docs": "/docs", "health": "/api/health"}

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "FixMyCity API"}

@app.get("/api/meta")
def metadata():
    return {"categories": CATEGORIES, "statuses": STATUSES, "priorities": PRIORITIES}

@app.post("/api/auth/register", status_code=201)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    email = data.email.lower()
    if db.query(User).filter(func.lower(User.email) == email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = User(name=data.name.strip(), email=email, password_hash=pwd_context.hash(data.password), role="citizen")
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"user": user_out(user), "message": "Account created. You can now log in."}

@app.post("/api/auth/login")
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(func.lower(User.email) == data.email.lower()).first()
    if not user or not pwd_context.verify(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    token = jwt.encode({"sub": str(user.id), "exp": expires}, settings.secret_key, algorithm="HS256")
    return {"access_token": token, "token_type": "bearer", "user": user_out(user)}

@app.get("/api/auth/me")
def me(user: User = Depends(get_current_user)):
    return user_out(user)

@app.get("/api/departments")
def list_departments(db: Session = Depends(get_db)):
    return [{"id": d.id, "name": d.name, "description": d.description} for d in db.query(Department).order_by(Department.name).all()]

@app.post("/api/departments", status_code=201)
def create_department(data: DepartmentIn, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    if db.query(Department).filter(func.lower(Department.name) == data.name.lower()).first():
        raise HTTPException(status_code=409, detail="Department already exists")
    department = Department(name=data.name.strip(), description=data.description.strip())
    db.add(department); db.commit(); db.refresh(department)
    return {"id": department.id, "name": department.name, "description": department.description}

@app.post("/api/issues", status_code=201)
def create_issue(data: IssueCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if data.category not in CATEGORIES:
        raise HTTPException(status_code=422, detail="Choose a valid issue category")
    issue = Issue(title=data.title.strip(), description=data.description.strip(), category=data.category, location=data.location.strip(), latitude=data.latitude, longitude=data.longitude, user_id=user.id)
    db.add(issue); db.flush()
    db.add(IssueUpdate(issue_id=issue.id, status="Submitted", comment="Issue reported", updated_by=user.id))
    db.commit(); db.refresh(issue)
    return issue_out(issue)

@app.get("/api/issues")
def list_issues(
    status: str | None = None, category: str | None = None, search: str | None = None,
    page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    query = db.query(Issue)
    if user.role != "admin":
        query = query.filter(Issue.user_id == user.id)
    if status:
        query = query.filter(Issue.status == status)
    if category:
        query = query.filter(Issue.category == category)
    if search:
        term = f"%{search.strip()}%"
        query = query.filter((Issue.title.ilike(term)) | (Issue.location.ilike(term)) | (Issue.description.ilike(term)))
    total = query.count()
    issues = query.order_by(Issue.created_at.desc()).offset((page-1)*page_size).limit(page_size).all()
    return {"items": [issue_out(i) for i in issues], "total": total, "page": page, "page_size": page_size}

@app.get("/api/issues/public")
def public_issues(status: str | None = None, category: str | None = None, search: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Issue)
    if status: query = query.filter(Issue.status == status)
    if category: query = query.filter(Issue.category == category)
    if search:
        term = f"%{search.strip()}%"
        query = query.filter((Issue.title.ilike(term)) | (Issue.location.ilike(term)))
    issues = query.order_by(Issue.created_at.desc()).limit(100).all()
    return [{"id": i.id, "title": i.title, "description": i.description, "category": i.category, "location": i.location, "latitude": i.latitude, "longitude": i.longitude, "status": i.status, "priority": i.priority, "created_at": i.created_at, "department_name": i.department.name if i.department else None} for i in issues]

@app.get("/api/issues/{issue_id}")
def get_issue(issue_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    issue = db.get(Issue, issue_id)
    if not issue: raise HTTPException(status_code=404, detail="Issue not found")
    if user.role != "admin" and issue.user_id != user.id: raise HTTPException(status_code=403, detail="You can only view your own issues")
    return issue_out(issue)

@app.patch("/api/issues/{issue_id}")
def update_issue(issue_id: int, data: IssueUpdateIn, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    issue = db.get(Issue, issue_id)
    if not issue: raise HTTPException(status_code=404, detail="Issue not found")
    if data.status is not None:
        if data.status not in STATUSES: raise HTTPException(status_code=422, detail="Invalid status")
        issue.status = data.status
    if data.priority is not None:
        if data.priority not in PRIORITIES: raise HTTPException(status_code=422, detail="Invalid priority")
        issue.priority = data.priority
    if data.department_id is not None:
        if not db.get(Department, data.department_id): raise HTTPException(status_code=404, detail="Department not found")
        issue.department_id = data.department_id
    issue.updated_at = datetime.now(timezone.utc)
    db.add(IssueUpdate(issue_id=issue.id, status=issue.status, comment=data.comment.strip(), updated_by=admin.id))
    db.commit(); db.refresh(issue)
    return issue_out(issue)

@app.post("/api/issues/{issue_id}/image", status_code=201)
def upload_issue_image(issue_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    issue = db.get(Issue, issue_id)
    if not issue: raise HTTPException(status_code=404, detail="Issue not found")
    if user.role != "admin" and issue.user_id != user.id: raise HTTPException(status_code=403, detail="You can only upload images to your own issues")
    allowed = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed: raise HTTPException(status_code=415, detail="Only JPG, PNG, and WEBP images are allowed")
    suffix = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}[file.content_type]
    filename = f"{uuid.uuid4().hex}{suffix}"
    target = Path(settings.upload_dir) / filename
    size = 0
    with target.open("wb") as out:
        while chunk := file.file.read(1024 * 1024):
            size += len(chunk)
            if size > 5 * 1024 * 1024:
                out.close()
                target.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="Image must be 5 MB or smaller")
            out.write(chunk)
    issue.image_path = f"/uploads/{filename}"
    issue.updated_at = datetime.now(timezone.utc)
    db.commit(); db.refresh(issue)
    return issue_out(issue)

@app.get("/api/admin/stats")
def admin_stats(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    total = db.query(Issue).count()
    by_status = {status: db.query(Issue).filter(Issue.status == status).count() for status in STATUSES}
    return {"total_issues": total, "total_users": db.query(User).count(), "by_status": by_status}

@app.get("/api/admin/users")
def admin_users(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {**user_out(user), "issue_count": db.query(Issue).filter(Issue.user_id == user.id).count()}
        for user in users
    ]

from fastapi.staticfiles import StaticFiles
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

@app.on_event("startup")
def seed_departments():
    with SessionLocal() as db:
        if db.query(Department).count() == 0:
            db.add_all([
                Department(name="Roads Department", description="Roads, potholes, and pavements"),
                Department(name="Sanitation Department", description="Garbage and public cleanliness"),
                Department(name="Electricity Department", description="Streetlights and electrical issues"),
                Department(name="Water Department", description="Water supply and drainage"),
                Department(name="Public Works", description="Other public infrastructure"),
            ])
            db.commit()


def promote_user_to_admin(email: str):
    email = email.strip().lower()

    with SessionLocal() as db:
        user = db.query(User).filter(
            func.lower(User.email) == email
        ).first()

        if user is None:
            print(f"User not found: {email}")
            return

        if user.role == "admin":
            print(f"{email} is already an admin.")
            return

        user.role = "admin"
        db.commit()

        print(f"Success! {email} is now an admin.")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["promote-admin"])
    parser.add_argument("email")
    args = parser.parse_args()

    if args.action == "promote-admin":
        promote_user_to_admin(args.email)
