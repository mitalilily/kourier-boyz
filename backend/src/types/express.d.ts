declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string
        role: string
        sessionVersion?: number
      }
      rawBody?: Buffer
    }
  }
}

export {}
