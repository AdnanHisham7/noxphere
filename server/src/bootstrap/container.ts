import { MongoUserRepository } from "@infrastructure/database/repositories/UserRepository";
import { MongoAcademyRepository } from "@infrastructure/database/repositories/AcademyRepository";

import { AuthUseCases } from "@application/use-cases/auth/AuthUseCases";
import { AcademyUseCases } from "@application/use-cases/academy/AcademyUseCases";

import { AuthController } from "@interfaces/http/controllers/AuthController";
import { AcademyController } from "@interfaces/http/controllers/AcademyController";

// Repositories
const userRepository = new MongoUserRepository();
const academyRepository = new MongoAcademyRepository();

// Use Cases
const authUseCases = new AuthUseCases(userRepository);
const academyUseCases = new AcademyUseCases(academyRepository, userRepository);

// Controllers
export const authController = new AuthController(authUseCases);
export const academyController = new AcademyController(academyUseCases);
