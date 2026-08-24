// src/controllers/plans.controller.ts
import { Request, Response } from 'express'
import { PlansService } from '../../models/services/plan.service'

export const PlansController = {
  getPlans: async (req: Request, res: Response) => {
    try {
      // Accept status filter from query params: ?status=active | inactive | all
      const status = req.query.status as 'active' | 'inactive' | undefined
      const businessType = req.query.businessType as 'b2c' | 'b2b' | 'international' | undefined

      const allPlans = await PlansService.getAll({ status, businessType })
      res.json(allPlans)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Failed to fetch plans' })
    }
  },

  createPlan: async (req: Request, res: Response) => {
    try {
      const { name, description, business_type } = req.body
      const plan = await PlansService.create({ name, description, business_type })
      res.status(201).json(plan)
    } catch (err) {
      res.status(500).json({ error: 'Failed to create plan' })
    }
  },
  updatePlan: async (req: Request, res: Response) => {
    try {
      const { id } = req.params
      const updatedPlan = await PlansService.update(id, req.body)
      res.status(200).json({
        success: true,
        message: 'Plan updated successfully',
        data: updatedPlan,
      })
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to update plan',
      })
      console.log('error updating plan', err)
    }
  },

  deletePlan: async (req: Request, res: Response) => {
    try {
      const { id } = req.params
      const plan = await PlansService.deactivate(id)
      if (!plan) return res.status(404).json({ error: 'Plan not found' })
      res.json({ success: true, message: 'Rate card deleted successfully', plan })
    } catch (err) {
      res.status(409).json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete rate card',
      })
    }
  },
  assignPlanToUser: async (req: Request, res: Response) => {
    try {
      const { userId, planId, businessType } = req.body
      if (!userId || !planId)
        return res.status(400).json({ error: 'userId and planId are required' })

      const result = await PlansService.assignOrUpdateUserPlan(userId, planId, businessType)
      res.status(200).json({
        success: true,
        message: 'Plan assigned/updated successfully',
        data: result,
      })
    } catch (err) {
      console.error('Error assigning plan to user:', err)
      res.status(500).json({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to assign plan',
      })
    }
  },
}
