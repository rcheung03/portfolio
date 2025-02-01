import { fetchJSON, renderProjects } from '../global.js';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
const projectsTitle = document.querySelector('.projects-title');

if (projects && projects.length > 0) {
    // Update title with count
    projectsTitle.textContent = `My Projects (${projects.length})`;
    
    // Clear container first
    projectsContainer.innerHTML = '';
    
    // Render each project
    projects.forEach(project => {
        const article = document.createElement('article');
        renderProjects(project, article, 'h2');
        projectsContainer.appendChild(article);
    });
} else {
    projectsContainer.innerHTML = '<p>No projects available.</p>';
}