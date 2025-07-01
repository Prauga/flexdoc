import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PetsService } from './pets.service';
import { CreatePetDto, UpdatePetDto, PetDto } from './dto/pet.dto';

@ApiTags('pets')
@Controller('pets')
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all pets' })
  @ApiResponse({ status: 200, description: 'Return all pets.', type: [PetDto] })
  findAll(): PetDto[] {
    return this.petsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a pet by id' })
  @ApiResponse({ status: 200, description: 'Return the pet.', type: PetDto })
  findOne(@Param('id') id: string): PetDto {
    return this.petsService.findOne(+id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a pet' })
  @ApiResponse({
    status: 201,
    description: 'The pet has been successfully created.',
    type: PetDto,
  })
  create(@Body() createPetDto: CreatePetDto): PetDto {
    return this.petsService.create(createPetDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a pet' })
  @ApiResponse({
    status: 200,
    description: 'The pet has been successfully updated.',
    type: PetDto,
  })
  update(@Param('id') id: string, @Body() updatePetDto: UpdatePetDto): PetDto {
    return this.petsService.update(+id, updatePetDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a pet' })
  @ApiResponse({
    status: 200,
    description: 'The pet has been successfully deleted.',
  })
  remove(@Param('id') id: string): void {
    return this.petsService.remove(+id);
  }
}

