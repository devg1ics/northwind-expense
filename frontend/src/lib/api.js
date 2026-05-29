import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const getEmployees = () => api.get('/employees').then(r => r.data)
export const createEmployee = (data) => api.post('/employees', data).then(r => r.data)
export const getSubmissions = (params = {}) => api.get('/submissions', { params: Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null)) }).then(r => r.data)
export const createSubmission = (data) => api.post('/submissions', data).then(r => r.data)
export const getSubmission = (id) => api.get(`/submissions/${id}`).then(r => r.data)
export const updateSubmission = (id, data) => api.patch(`/submissions/${id}`, data).then(r => r.data)
export const deleteSubmission = (id) => api.delete(`/submissions/${id}`)
export const getSubmissionItems = (id) => api.get(`/submissions/${id}/items`).then(r => r.data)
export const uploadReceipt = (subId, file, onProgress) => {
  const form = new FormData()
  form.append('file', file)
  return api.post(`/submissions/${subId}/receipts`, form, {
    onUploadProgress: onProgress,
  }).then(r => r.data)
}
export const overrideItem = (itemId, data) => api.post(`/items/${itemId}/override`, data).then(r => r.data)
export const deleteItem = (itemId) => api.delete(`/items/${itemId}`)
export const getAuditLog = (itemId) => api.get(`/items/${itemId}/audit`).then(r => r.data)
export const askPolicy = (question) => api.post('/policy/ask', { question }).then(r => r.data)
