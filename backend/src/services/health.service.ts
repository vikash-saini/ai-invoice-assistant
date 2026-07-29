import { ApiResponse } from "../types/api-response";

export class HealthService {
    getHealthStatus(): ApiResponse<{ timestamp: string }> {
        return {
            success: true,
            message: 'Ai Invoice assistant API is running',
            data: {
                timestamp: new Date().toISOString()
            }
             
        }
    }
}