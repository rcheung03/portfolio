export async function fetchJSON(url) {
  try {
      // Fetch the JSON file from the given URL
      const response = await fetch(url);
      
      if (!response.ok) {
          throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }

      const data = await response.json();
      return data;

  } catch (error) {
      console.error('Error fetching or parsing JSON data:', error);
  }
}

export function renderProjects(project, containerElement, headingLevel = 'h2') {
  // Validate parameters
  if (!project || !containerElement) {
      console.error('Missing required parameters for renderProjects');
      return;
  }

  // Clear existing content
  containerElement.innerHTML = '';

  // Validate heading level
  const validHeadings = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  if (!validHeadings.includes(headingLevel)) {
      console.warn(`Invalid heading level: ${headingLevel}. Defaulting to h2.`);
      headingLevel = 'h2';
  }

  // Create and append article
  const article = document.createElement('article');
  article.innerHTML = `
      <${headingLevel}>${project.title || 'Untitled Project'}</${headingLevel}>
      <img src="${project.image || ''}" alt="${project.title || 'Project image'}">
      <p>${project.description || 'No description available.'}</p>
  `;

  containerElement.appendChild(article);
}

export async function fetchGitHubData(username) {
  return fetchJSON(`https://api.github.com/users/${username}`);
}


console.log('IT’S ALIVE!');
console.log('Current pathname:', location.pathname);  // Add this line here

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

const ARE_WE_HOME = document.documentElement.classList.contains('home');

let pages = [
    { url: '', title: 'Home' },
    { url: 'projects', title: 'Projects' },
    { url: 'contact', title: 'Contact' },
    { url: 'resume', title: 'Resume' },
    { url: 'https://github.com/rcheung03', title: 'GitHub' }
  ];
let nav = document.createElement('nav');
document.body.prepend(nav);

for (let p of pages) {
 let url = p.url;
 let title = p.title;
 
 url = !ARE_WE_HOME && !url.startsWith('http') ? '../' + url : url;
 
 let a = document.createElement('a');
 a.href = url;
 a.textContent = title;

   // Add these three lines here
console.log('Link URL:', url);
console.log('Link pathname:', a.pathname);
console.log('Pathname comparison:', a.pathname === location.pathname);
 
a.classList.toggle(
    'current',
    a.host === location.host && a.pathname.replace(/\/$/, '') === location.pathname.replace(/\/$/, '')
  );
 
 if (a.host !== location.host) {
   a.target = "_blank";
 }
 
 nav.append(a);
}
document.body.insertAdjacentHTML(
    'afterbegin',
    `<label class="color-scheme">
      Theme:
      <select>
        <option value="light dark">Automatic</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>`
  );
  
  // Optional: Show current system theme
const darkModePreference = window.matchMedia("(prefers-color-scheme: dark)").matches;
const autoText = darkModePreference ? "Automatic (Dark)" : "Automatic (Light)";
document.querySelector('.color-scheme option[value="light dark"]').textContent = autoText;

const select = document.querySelector('.color-scheme select');

if ("colorScheme" in localStorage) {
    const savedScheme = localStorage.colorScheme;
    document.documentElement.style.setProperty('color-scheme', savedScheme);
    select.value = savedScheme;
}

// Add event listener for theme changes
select.addEventListener('input', function (event) {
    const newScheme = event.target.value;
    console.log('color scheme changed to', newScheme);
    document.documentElement.style.setProperty('color-scheme', newScheme);
    localStorage.colorScheme = newScheme;  // Save to localStorage
});
