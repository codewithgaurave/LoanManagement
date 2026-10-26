const express = require('express');
const router = express.Router();
const { 
  getDepartments,
  getDepartmentHierarchy,
  assignDepartmentHead,
  createDepartment,
  updateDepartment,
  deleteDepartment 
} = require('../controllers/departmentController');

router.route('/')
  .get(getDepartments)
  .post(createDepartment);

router.get('/hierarchy', getDepartmentHierarchy);
router.put('/:id/assign-head', assignDepartmentHead);

router.route('/:id')
  .put(updateDepartment)
  .delete(deleteDepartment);

module.exports = router;
