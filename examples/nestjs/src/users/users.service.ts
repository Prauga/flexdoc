import { Injectable } from '@nestjs/common';
import { CreateUserDto, UpdateUserDto, UserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  private users: UserDto[] = [
    { id: 1, name: 'John Doe', email: 'john@example.com', age: 30 },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', age: 25 },
  ];

  findAll(): UserDto[] {
    return this.users;
  }

  findOne(id: number): UserDto {
    return this.users.find((user) => user.id === id);
  }

  create(createUserDto: CreateUserDto): UserDto {
    const newUser = {
      id: this.users.length + 1,
      ...createUserDto,
    };
    this.users.push(newUser);
    return newUser;
  }

  update(id: number, updateUserDto: UpdateUserDto): UserDto {
    const userIndex = this.users.findIndex((user) => user.id === id);
    if (userIndex > -1) {
      this.users[userIndex] = { ...this.users[userIndex], ...updateUserDto };
      return this.users[userIndex];
    }
    return null;
  }

  remove(id: number): void {
    this.users = this.users.filter((user) => user.id !== id);
  }
}
