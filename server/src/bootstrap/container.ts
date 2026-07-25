import { MongoUserRepository } from "@infrastructure/database/repositories/UserRepository";
import { MongoAcademyRepository } from "@infrastructure/database/repositories/AcademyRepository";
import { MongoStudentRepository } from "@infrastructure/database/repositories/StudentRepository";

import { AuthUseCases } from "@application/use-cases/auth/AuthUseCases";
import { AcademyUseCases } from "@application/use-cases/academy/AcademyUseCases";
import { StudentUseCases } from "@application/use-cases/student/StudentUseCases";

import { AuthController } from "@interfaces/http/controllers/AuthController";
import { AcademyController } from "@interfaces/http/controllers/AcademyController";
import { StudentController } from "@interfaces/http/controllers/StudentController";

// Repositories
const userRepository = new MongoUserRepository();
const academyRepository = new MongoAcademyRepository();
const studentRepository = new MongoStudentRepository();

// Use Cases
const authUseCases = new AuthUseCases(userRepository, academyRepository);
const academyUseCases = new AcademyUseCases(academyRepository, userRepository);
const studentUseCases = new StudentUseCases(studentRepository, userRepository);

// Controllers
export const authController = new AuthController(authUseCases);
export const academyController = new AcademyController(academyUseCases);
export const studentController = new StudentController(studentUseCases);
