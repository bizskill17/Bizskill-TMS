
import React from 'react';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  section?: string;
  count?: number;
}

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  iconBgColor: string;
  iconColor: string;
  onClick?: () => void;
}

export interface QuickActionProps {
  label: string;
  icon: React.ReactNode;
  colorClass: string;
  onClick?: () => void;
}

export interface TableRow {
  name: string;
  total: number;
  notStarted: number;
  inProgress: number;
  pendingClient: number;
  pendingOwner: number;
  pendingTraining: number;
  pendingBilling: number;
  pendingPayment: number;
  statusCounts?: Record<string, number>;
}

export interface Task {
  id: number;
  title: string;
  assignees: string;
  owner: string;
  project: string;
  firm?: string;
  clientName?: string; 
  category?: string;
  vendor?: string; 
  vendorCategory?: string; 
  status: 'Completed' | 'Not Yet Started' | 'In Progress' | 'Started' | 'Pending for Client' | 'Pending for Owner' | 'Pending for Training' | 'Pending for Billing' | 'Pending for Payment';
  priority: 'Medium' | 'High' | 'Low';
  dueDate: string;
  date: string; 
  remarks?: string; 
  lastUpdateDate?: string;
  lastUpdateRemarks?: string;
  hours?: number;
  time?: string;
  goal?: number;
  achieved?: number | string;
  photos?: string; // JSON stringified array of data URLs
  pdf?: string; // data URL
}

export interface RecurringTask {
			  id: number;
			  title: string;
        notes?: string;
			  firm?: string;
        owner?: string;
			  category: string;
		  assignee: string;
		  frequencyDays: number;
		  startDate: string;
		  time?: string;
		  goal?: number;
		  lastUpdatedOn?: string;
		  lastUpdateRemarks?: string;
		  status?: 'Not Yet Started' | 'In Progress' | 'Complete' | 'Pending for Client' | 'Pending for Owner';
		  periodicity?: 'Fixed Days' | 'Weekly' | 'Monthly' | 'Yearly';
		  recurrenceDay?: number; // 0-6 for Weekly, 1-31 for Monthly/Yearly
		  recurrenceMonth?: string; // Month name for Yearly
		}

export interface RecurringTaskAction {
  id: number;
  taskId: number;
  taskTitle: string;
  firm?: string;
  owner?: string;
  category: string;
  assignee: string;
  status: 'Not Yet Started' | 'In Progress' | 'Complete' | 'Pending for Client' | 'Pending for Owner';
  updatedOn: string; 
  timestamp: string; 
  remarks: string;
  goal?: number;
  taskGoal?: number | string;
  photos?: string;
  pdf?: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  employeeId?: string;
  mobile: string;
  designation: string;
  department?: string;
  role: string;
  isActive: boolean;
  telegramUserName?: string;
  password?: string;
  tenantId?: number;
  tenantCode?: string;
  tenantName?: string;
  isPlatformAdmin?: boolean;
  platformAdminEmail?: string;
  platformAdminToken?: string;
}

export interface Organization {
  id: number;
  orgId: string;
  orgName: string;
  dbMode: 'shared' | 'dedicated';
  status: 'active' | 'inactive';
  domain?: string;
  dbHost?: string;
  dbName?: string;
  dbUser?: string;
  hasConnection?: boolean;
}

export interface Designation {
  id: number;
  title: string;
  description: string;
}

export interface Department {
  id: number;
  name: string;
}
export interface Category {
    id: number;
    name: string;
    type: string;
}

export interface VendorCategory {
    id: number;
    name: string;
}

export interface Client {
    id: number;
    name: string;
    email: string;
    mobile: string;
    address: string;
    gstNumber?: string;
}

export interface Vendor {
    id: number;
    name: string;
    email: string;
    mobile: string;
    address: string;
    gstNumber?: string;
}

export interface Project {
    id: number;
    name: string;
    client: string;
    status: string;
    telegramGroupId?: string;
    whatsappGroupId?: string;
    projectEmail?: string;
}

export interface Firm {
    id: number;
    name: string;
    sortName?: string;
}

export interface ActionLogEntry {
    id: number;
    taskId: number;
    task: string;
    taskDate: string;
    updateDate: string;
    status: string;
    remarks: string;
    owner: string;
    assignees: string;
    project: string;
    firm?: string;
    clientName?: string; 
    vendor?: string;
    hours?: number;
    time?: string;
    goal?: number;
    taskGoal?: number | string;
    photos?: string;
    pdf?: string;
}

export interface AppSettings {
  officeTokenId: string;
  officeTelegramGroupId: string;
  whatsappGroupId: string;
  masId: string;
  masPassword: string;
  metaAccessToken: string;
  metaPhoneNumberId: string;
  metaWabaId: string;
  metaVerifyToken: string;
  viewLabelOverrides?: Record<string, string> | string;
  fieldLabelOverrides?: Record<string, string> | string;
}

export interface StatusMaster {
  id: number;
  name: string;
  is_system?: number | boolean;
}
