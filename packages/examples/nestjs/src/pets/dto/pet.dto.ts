import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreatePetDto {
  @ApiProperty({ description: 'The name of the pet' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'The species of the pet' })
  @IsString()
  species: string;

  @ApiProperty({ description: 'The age of the pet' })
  @IsNumber()
  age: number;
}

export class UpdatePetDto extends PartialType(CreatePetDto) {}

export class PetDto extends CreatePetDto {
  @ApiProperty({ description: 'The unique identifier of the pet' })
  id: number;
}
