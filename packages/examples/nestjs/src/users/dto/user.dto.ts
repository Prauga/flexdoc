import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsString, IsEmail, IsNumber, IsOptional } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ description: 'The name of the user' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'The email of the user' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'The age of the user' })
  @IsNumber()
  age: number;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {}

export class UserDto extends CreateUserDto {
  @ApiProperty({ description: 'The unique identifier of the user' })
  id: number;
}
