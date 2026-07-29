import {Request, Response} from 'express';
import { HealthService } from '../services/health.service';

export class HealthController {
    private readonly healthService = new HealthService();

    getHealth = (_req:Request, res:Response): void =>{
        const health = this.healthService.getHealthStatus();

        res.status(200).json(health);
    }
}