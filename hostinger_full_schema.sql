-- TaskPro full schema for Hostinger MySQL
-- Import this file in phpMyAdmin for database: u380752258_bizskillTMSCA

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  employee_id VARCHAR(50) DEFAULT NULL,
  mobile VARCHAR(30) DEFAULT '',
  role VARCHAR(50) NOT NULL DEFAULT 'Employee',
  designation VARCHAR(120) DEFAULT '',
  department VARCHAR(100) DEFAULT NULL,
  telegram_user_name VARCHAR(120) DEFAULT NULL,
  password VARCHAR(255) NOT NULL,
  isActive TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_users_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS designations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(190) NOT NULL,
  type VARCHAR(120) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_category_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS status_master (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vendor_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(190) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_vendor_category_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(190) NOT NULL,
  email VARCHAR(190) DEFAULT '',
  mobile VARCHAR(30) DEFAULT '',
  address TEXT,
  gstNumber VARCHAR(60) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_clients_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS firms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(190) NOT NULL,
  sortName VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_firm_name (name),
  KEY idx_firms_sort_name (sortName)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vendors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(190) NOT NULL,
  email VARCHAR(190) DEFAULT '',
  mobile VARCHAR(30) DEFAULT '',
  address TEXT,
  gstNumber VARCHAR(60) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_vendors_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(190) NOT NULL,
  client VARCHAR(190) DEFAULT '',
  projectType VARCHAR(120) DEFAULT '',
  status VARCHAR(60) DEFAULT 'Active',
  telegramGroupId VARCHAR(255) DEFAULT '',
  whatsappGroupId VARCHAR(255) DEFAULT '',
  projectEmail VARCHAR(190) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_project_name (name),
  KEY idx_projects_client (client)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS main_tasks (
  id BIGINT PRIMARY KEY,
  date VARCHAR(20) DEFAULT '',
  title VARCHAR(255) NOT NULL,
  description TEXT,
  project VARCHAR(190) DEFAULT '',
  firm VARCHAR(190) DEFAULT '',
  category VARCHAR(190) DEFAULT '',
  owner VARCHAR(190) DEFAULT '',
  assignees TEXT,
  client VARCHAR(190) DEFAULT '',
  priority VARCHAR(50) DEFAULT 'Medium',
  status VARCHAR(80) DEFAULT 'Not Yet Started',
  dueDate VARCHAR(20) DEFAULT '',
  lastUpdateDate VARCHAR(30) DEFAULT '',
  lastUpdateRemarks TEXT,
  hours DECIMAL(10,2) DEFAULT 0,
  time VARCHAR(10) DEFAULT '',
  goal VARCHAR(255) DEFAULT '',
  photos MEDIUMTEXT,
  pdf MEDIUMTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_main_tasks_project (project),
  KEY idx_main_tasks_owner (owner),
  KEY idx_main_tasks_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vendor_tasks (
  id BIGINT PRIMARY KEY,
  date VARCHAR(20) DEFAULT '',
  title VARCHAR(255) NOT NULL,
  description TEXT,
  project VARCHAR(190) DEFAULT '',
  firm VARCHAR(190) DEFAULT '',
  category VARCHAR(190) DEFAULT '',
  owner VARCHAR(190) DEFAULT '',
  assignees TEXT,
  vendor VARCHAR(190) DEFAULT '',
  vendorCategory VARCHAR(190) DEFAULT '',
  priority VARCHAR(50) DEFAULT 'Medium',
  status VARCHAR(80) DEFAULT 'Not Yet Started',
  dueDate VARCHAR(20) DEFAULT '',
  lastUpdateDate VARCHAR(30) DEFAULT '',
  lastUpdateRemarks TEXT,
  hours DECIMAL(10,2) DEFAULT 0,
  time VARCHAR(10) DEFAULT '',
  goal VARCHAR(255) DEFAULT '',
  photos MEDIUMTEXT,
  pdf MEDIUMTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_vendor_tasks_project (project),
  KEY idx_vendor_tasks_owner (owner),
  KEY idx_vendor_tasks_vendor (vendor),
  KEY idx_vendor_tasks_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS action_logs (
  id BIGINT PRIMARY KEY,
  taskId BIGINT NOT NULL,
  taskTitle VARCHAR(255) DEFAULT '',
  taskDate VARCHAR(20) DEFAULT '',
  updateDate VARCHAR(30) DEFAULT '',
  project VARCHAR(190) DEFAULT '',
  firm VARCHAR(190) DEFAULT '',
  client VARCHAR(190) DEFAULT '',
  category VARCHAR(190) DEFAULT '',
  owner VARCHAR(190) DEFAULT '',
  assignees TEXT,
  vendor VARCHAR(190) DEFAULT '',
  status VARCHAR(80) DEFAULT '',
  remarks TEXT,
  hours DECIMAL(10,2) DEFAULT 0,
  time VARCHAR(10) DEFAULT '',
  goal VARCHAR(255) DEFAULT '',
  photos MEDIUMTEXT,
  pdf MEDIUMTEXT,
  updatedOn VARCHAR(20) DEFAULT '',
  timestamp VARCHAR(30) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_action_logs_task (taskId),
  KEY idx_action_logs_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS recurring_tasks (
  id BIGINT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  notes LONGTEXT,
  firm VARCHAR(190) DEFAULT '',
  owner VARCHAR(190) DEFAULT '',
  category VARCHAR(190) DEFAULT '',
  assignee VARCHAR(190) DEFAULT '',
  frequencyType VARCHAR(50) DEFAULT 'Fixed Days',
  frequencyDays INT DEFAULT 0,
  recurrenceDay INT DEFAULT 0,
  recurrenceMonth VARCHAR(50) DEFAULT '',
  startDate VARCHAR(20) DEFAULT '',
  time VARCHAR(10) DEFAULT '',
  goal VARCHAR(255) DEFAULT '',
  status VARCHAR(80) DEFAULT 'Not Yet Started',
  lastUpdatedOn VARCHAR(20) DEFAULT '',
  lastUpdateRemarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_recurring_tasks_owner (owner),
  KEY idx_recurring_tasks_assignee (assignee),
  KEY idx_recurring_tasks_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS recurring_actions (
  id BIGINT PRIMARY KEY,
  taskId BIGINT NOT NULL,
  taskTitle VARCHAR(255) DEFAULT '',
  firm VARCHAR(190) DEFAULT '',
  owner VARCHAR(190) DEFAULT '',
  category VARCHAR(190) DEFAULT '',
  assignee VARCHAR(190) DEFAULT '',
  status VARCHAR(80) DEFAULT '',
  remarks TEXT,
  goal VARCHAR(255) DEFAULT '',
  photos MEDIUMTEXT,
  pdf MEDIUMTEXT,
  updatedOn VARCHAR(20) DEFAULT '',
  timestamp VARCHAR(30) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_recurring_actions_task (taskId),
  KEY idx_recurring_actions_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS app_settings (
  id INT PRIMARY KEY DEFAULT 1,
  officeTokenId VARCHAR(255) DEFAULT '',
  officeTelegramGroupId VARCHAR(255) DEFAULT '',
  whatsappGroupId VARCHAR(255) DEFAULT '',
  masId VARCHAR(255) DEFAULT '',
  masPassword VARCHAR(255) DEFAULT '',
  metaAccessToken TEXT,
  metaPhoneNumberId VARCHAR(255) DEFAULT '',
  metaWabaId VARCHAR(255) DEFAULT '',
  metaVerifyToken VARCHAR(255) DEFAULT '',
  viewLabelOverrides TEXT,
  fieldLabelOverrides TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notification_queue (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  channel VARCHAR(20) NOT NULL,
  provider VARCHAR(20) NOT NULL,
  targetType VARCHAR(20) NOT NULL,
  target VARCHAR(255) NOT NULL,
  message MEDIUMTEXT NOT NULL,
  meta JSON NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  lastError TEXT NULL,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_queue_status_created (status, createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notification_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  eventType VARCHAR(50) NOT NULL,
  channel VARCHAR(20) NOT NULL,
  provider VARCHAR(20) NOT NULL,
  target VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL,
  error TEXT NULL,
  createdAt DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_logs_created (createdAt),
  KEY idx_logs_event (eventType)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO app_settings (id)
VALUES (1)
ON DUPLICATE KEY UPDATE id = 1;

INSERT INTO status_master (name, is_system)
VALUES
  ('Not Yet Started', 1),
  ('In Progress', 1),
  ('Completed', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  is_system = VALUES(is_system);

INSERT INTO users (name, email, role, password, isActive)
VALUES ('Admin', 'bizskill17@gmail.com', 'Admin', '!Office1@', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  role = VALUES(role),
  isActive = VALUES(isActive);
