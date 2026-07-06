-- Migration: Add meta_data column to projects table
ALTER TABLE projects ADD COLUMN meta_data TEXT DEFAULT '{}';