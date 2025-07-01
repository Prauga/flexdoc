import { Module } from '@nestjs/common';
import { PetsModule } from './pets/pets.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [PetsModule, UsersModule],
})
export class AppModule {}

