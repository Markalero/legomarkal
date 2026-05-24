from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import schemas, models, database

router = APIRouter(
    prefix="/sets",
    tags=["sets"]
)

@router.post("/", response_model=schemas.LegoSet)
def create_set(lego_set: schemas.LegoSetCreate, db: Session = Depends(database.get_db)):
    db_set = models.LegoSet(**lego_set.model_dump())
    db.add(db_set)
    db.commit()
    db.refresh(db_set)
    return db_set

@router.get("/", response_model=List[schemas.LegoSet])
def read_sets(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    sets = db.query(models.LegoSet).offset(skip).limit(limit).all()
    return sets

@router.get("/{set_id}", response_model=schemas.LegoSet)
def read_set(set_id: int, db: Session = Depends(database.get_db)):
    db_set = db.query(models.LegoSet).filter(models.LegoSet.id == set_id).first()
    if db_set is None:
        raise HTTPException(status_code=404, detail="Set not found")
    return db_set

@router.put("/{set_id}", response_model=schemas.LegoSet)
def update_set(set_id: int, lego_set: schemas.LegoSetUpdate, db: Session = Depends(database.get_db)):
    db_set = db.query(models.LegoSet).filter(models.LegoSet.id == set_id).first()
    if db_set is None:
        raise HTTPException(status_code=404, detail="Set not found")
    
    update_data = lego_set.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_set, key, value)
        
    db.commit()
    db.refresh(db_set)
    return db_set

@router.delete("/{set_id}")
def delete_set(set_id: int, db: Session = Depends(database.get_db)):
    db_set = db.query(models.LegoSet).filter(models.LegoSet.id == set_id).first()
    if db_set is None:
        raise HTTPException(status_code=404, detail="Set not found")
    db.delete(db_set)
    db.commit()
    return {"message": "Set deleted successfully"}
