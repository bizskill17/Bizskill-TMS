
import React, { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, Folder, LayoutGrid, LayoutList, Send, Mail, MessageSquare, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Project, Client } from '../types';
import { AddProjectModal } from './AddProjectModal';
import { EditProjectModal } from './EditProjectModal';
import { ConfirmationModal } from './ConfirmationModal';
import { useLabels } from '../labelOverrides';

interface ProjectsViewProps {
  projects: Project[];
  clients: Client[];
  onAddProject: (project: Omit<Project, 'id'>) => void;
  onDeleteProject: (id: number) => void;
  onEditProject: (project: Project) => void;
  onAddClient: () => void;
  onNavigateToProjectTasks?: (projectName: string) => void;
}

type SortConfig = {
  key: keyof Project;
  direction: 'asc' | 'desc';
} | null;

export const ProjectsView: React.FC<ProjectsViewProps> = ({ projects, clients, onAddProject, onDeleteProject, onEditProject, onAddClient, onNavigateToProjectTasks }) => {
  const { getViewLabel } = useLabels();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  const requestSort = (key: keyof Project) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof Project) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown size={14} className="ml-1 opacity-50" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 text-white" /> : <ArrowDown size={14} className="ml-1 text-white" />;
  };

  const sortedProjects = useMemo(() => {
    let sortableItems = [...projects];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key] ?? '';
        const bValue = b[sortConfig.key] ?? '';
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [projects, sortConfig]);

  const handleEditClick = (project: Project) => {
    setSelectedProject(project);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (project: Project) => {
    setSelectedProject(project);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (selectedProject) {
        onDeleteProject(selectedProject.id);
        setIsDeleteModalOpen(false);
    }
  };

  const thClass = "px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider border-r border-indigo-500 last:border-r-0 cursor-pointer bg-indigo-600 hover:bg-indigo-700 transition-colors select-none";
  const tdClass = "px-6 py-4 text-sm text-gray-900 border-r border-black last:border-r-0";

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-indigo-600">{getViewLabel('projects', 'Projects')}</h2>
          <p className="text-sm text-gray-500 mt-1">Manage client projects and communication channels</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-indigo-300 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full md:max-w-xl">
           <Search className="absolute left-3 top-2.5 text-indigo-600" size={18} />
          <input 
            type="text" 
            placeholder="Search projects..."
            className="w-full pl-10 pr-4 py-2 border border-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 text-sm"
          />
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
            <div className="flex bg-gray-100 p-1 rounded-lg">
                <button onClick={() => setViewMode('card')} className={`p-1.5 rounded-md transition-all ${viewMode === 'card' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-indigo-400'}`}><LayoutGrid size={18} /></button>
                <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}><LayoutList size={18} /></button>
            </div>
            <button onClick={() => setIsModalOpen(true)} className="flex-1 md:flex-none flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium shadow-sm transition-colors whitespace-nowrap"><Plus size={16} /><span>Add Project</span></button>
        </div>
      </div>

      <div className={`bg-white rounded-lg border border-black shadow-sm overflow-hidden ${viewMode === 'card' ? 'hidden md:block' : 'block'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-indigo-600 border-b border-indigo-700">
                <th className={thClass} onClick={() => requestSort('id')}><div className="flex items-center">S.No. {getSortIcon('id')}</div></th>
                <th className={thClass} onClick={() => requestSort('name')}><div className="flex items-center">Project Name (Client) {getSortIcon('name')}</div></th>
                <th className={thClass} onClick={() => requestSort('projectEmail')}><div className="flex items-center">Project Email {getSortIcon('projectEmail')}</div></th>
                <th className={thClass} onClick={() => requestSort('telegramGroupId')}><div className="flex items-center">Telegram Group {getSortIcon('telegramGroupId')}</div></th>
                <th className={thClass} onClick={() => requestSort('whatsappGroupId')}><div className="flex items-center">WhatsApp Group {getSortIcon('whatsappGroupId')}</div></th>
                <th className={thClass} onClick={() => requestSort('status')}><div className="flex items-center">Status {getSortIcon('status')}</div></th>
                <th className="px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider border-r border-indigo-500 last:border-r-0 text-center bg-indigo-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {sortedProjects.map((project, index) => (
                <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                  <td className={tdClass}>{index + 1}</td>
                  <td className={tdClass}>
                     <button onClick={() => onNavigateToProjectTasks && onNavigateToProjectTasks(project.name)} className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline text-left">
                        {project.name} <span className="font-medium text-gray-500">({project.client})</span>
                     </button>
                  </td>
                  <td className={tdClass}>{project.projectEmail || '-'}</td>
                  <td className={tdClass}>{project.telegramGroupId || '-'}</td>
                  <td className={tdClass}>{project.whatsappGroupId || '-'}</td>
                  <td className={tdClass}>
                     <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${project.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{project.status}</span>
                  </td>
                  <td className={`${tdClass} text-center`}>
                    <div className="flex items-center justify-center space-x-3">
                      <button onClick={() => handleEditClick(project)} className="text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 p-1.5 rounded-md border border-indigo-100"><Edit2 size={16} /></button>
                      <button type="button" onClick={() => handleDeleteClick(project)} className="text-red-500 hover:text-red-700 transition-colors bg-red-50 p-1.5 rounded-md border border-red-100"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedProjects.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No projects found. Add a new project to get started.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`space-y-4 md:hidden ${viewMode === 'card' ? 'block' : 'hidden'}`}>
        {sortedProjects.map((project) => (
             <div key={project.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                 <div className="flex justify-between items-start mb-2">
                     <button onClick={() => onNavigateToProjectTasks && onNavigateToProjectTasks(project.name)} className="font-bold text-indigo-600 hover:underline text-left text-lg leading-tight">
                        {project.name} <span className="text-gray-400 font-medium text-sm">({project.client})</span>
                     </button>
                     <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ml-2 ${project.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{project.status}</span>
                 </div>
                 <div className="space-y-2 text-xs text-gray-500 mb-4 bg-gray-50 p-2 rounded">
                    {project.projectEmail && <div className="flex items-center gap-2"><Mail size={12} /><span>{project.projectEmail}</span></div>}
                    {project.telegramGroupId && <div className="flex items-center gap-2"><Send size={12} /><span>TG: {project.telegramGroupId}</span></div>}
                    {project.whatsappGroupId && <div className="flex items-center gap-2"><MessageSquare size={12} /><span>WA: {project.whatsappGroupId}</span></div>}
                 </div>
                 <div className="flex gap-2 pt-3 border-t border-gray-100">
                     <button onClick={() => handleEditClick(project)} className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"><Edit2 size={16} />Edit</button>
                     <button onClick={() => handleDeleteClick(project)} className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"><Trash2 size={16} />Delete</button>
                 </div>
             </div>
        ))}
         {projects.length === 0 && <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-gray-200">No projects found.</div>}
      </div>

      <AddProjectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={onAddProject} clients={clients} onAddClient={onAddClient} />
      <EditProjectModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSave={onEditProject} project={selectedProject} clients={clients} onAddClient={onAddClient} />
      <ConfirmationModal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)} 
        onConfirm={confirmDelete}
        title="Delete Project"
        message={`Are you sure you want to delete ${selectedProject?.name}? This action will permanently remove the project record.`}
      />
    </div>
  );
};
