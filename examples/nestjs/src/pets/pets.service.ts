import { Injectable } from '@nestjs/common';
import { CreatePetDto, UpdatePetDto, PetDto } from './dto/pet.dto';

@Injectable()
export class PetsService {
  private pets: PetDto[] = [
    { id: 1, name: 'Fluffy', species: 'cat', age: 3 },
    { id: 2, name: 'Buddy', species: 'dog', age: 5 },
  ];

  findAll(): PetDto[] {
    return this.pets;
  }

  findOne(id: number): PetDto {
    return this.pets.find((pet) => pet.id === id);
  }

  create(createPetDto: CreatePetDto): PetDto {
    const newPet = {
      id: this.pets.length + 1,
      ...createPetDto,
    };
    this.pets.push(newPet);
    return newPet;
  }

  update(id: number, updatePetDto: UpdatePetDto): PetDto {
    const petIndex = this.pets.findIndex((pet) => pet.id === id);
    if (petIndex > -1) {
      this.pets[petIndex] = { ...this.pets[petIndex], ...updatePetDto };
      return this.pets[petIndex];
    }
    return null;
  }

  remove(id: number): void {
    this.pets = this.pets.filter((pet) => pet.id !== id);
  }
}
