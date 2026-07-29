export class HealthService {
    getHealthStatus () {
        return {
            success: true,
            message: 'Ai Invoice assistant API is running',
            timestamp: new Date().toISOString() 
        }
    }
}