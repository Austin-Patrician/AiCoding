from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def read_example():
    return {"message": "Hello from example endpoint"}
