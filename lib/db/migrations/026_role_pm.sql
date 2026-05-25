-- Ensure project_manager role exists in ai_role_assignments
INSERT INTO ai_role_assignments (role) VALUES ('project_manager')
ON CONFLICT (role) DO NOTHING;
