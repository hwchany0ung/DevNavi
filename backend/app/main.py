from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from app.core.config import settings
from app.api.roadmap import router as roadmap_router

app = FastAPI(
    title="CareerPath API",
    version="0.1.0",
    docs_url="/docs" if settings.ENV == "development" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(roadmap_router)


@app.get("/health")
async def health():
    return {"status": "ok"}


# AWS Lambda 핸들러
handler = Mangum(app)
