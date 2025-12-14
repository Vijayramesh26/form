// src/services/kycService.js
import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:26301', // <--- change if backend URL differs
  timeout: 15000,
})

export default {
  // Types (top-level choices & fees)
  getTypes() {
    return api.get('/types').then((r) => r.data)
  },

  // All steps (metadata) if needed
  getSteps() {
    return api.get('/steps').then((r) => r.data)
  },

  // Fields merged with overrides for a given type_key
  getFields(typeKey) {
    return api.get('/fields', { params: { type_key: typeKey } }).then((r) => r.data)
  },

  // Save step forms (call dedicated endpoints)
  saveIdentity(payload) {
    return api.post('/identity', payload).then((r) => r.data)
  },
  saveAddress(payload) {
    return api.post('/address', payload).then((r) => r.data)
  },
  savePromoter(payload) {
    return api.post('/promoter', payload).then((r) => r.data)
  },
  saveBank(payload) {
    return api.post('/bank', payload).then((r) => r.data)
  },
  saveTrading(payload) {
    return api.post('/trading', payload).then((r) => r.data)
  },
  saveAdditional(payload) {
    return api.post('/additional', payload).then((r) => r.data)
  },

  // Save full KYC draft (optional)
  saveKyc(payload) {
    return api.post('/kyc/save', payload).then((r) => r.data)
  },

  // Create/save payment (backend route earlier: /payment/save)
  createPayment(payload) {
    return api.post('/payment/save', payload).then((r) => r.data)
  },
}
