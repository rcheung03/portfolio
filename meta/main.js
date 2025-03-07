let selectedCommits = [];
let data = [];
let commits = [];
let brushSelection = null;
let xScale, yScale;
let commitProgress = 100; // New variable for the slider value
let timeScale; // New scale to map dates to percentages

const width = 1000;
const height = 600;

function updateTooltipContent(commit) {
   const link = document.getElementById('commit-link');
   const date = document.getElementById('commit-date');
   const time = document.getElementById('commit-time');
   const author = document.getElementById('commit-author');
   const lines = document.getElementById('commit-lines');

   if (Object.keys(commit).length === 0) return;

   link.href = commit.url;
   link.textContent = commit.id;
   date.textContent = commit.datetime?.toLocaleString('en', {
       dateStyle: 'full',
   });
   time.textContent = commit.time;
   author.textContent = commit.author;
   lines.textContent = commit.totalLines;
}

function updateTooltipVisibility(isVisible) {
   const tooltip = document.getElementById('commit-tooltip');
   tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
   const tooltip = document.getElementById('commit-tooltip');
   tooltip.style.left = (event.pageX + 10) + 'px';
   tooltip.style.top = (event.pageY + 10) + 'px';
}

function isCommitSelected(commit) {
    return selectedCommits.includes(commit);
}

function updateSelectionCount() {
   // No need to refilter selectedCommits as it's now a global variable
   const countElement = document.getElementById('selection-count');
   countElement.textContent = `${selectedCommits.length || 'No'} commits selected`;
   return selectedCommits;
}

function updateLanguageBreakdown() {
   // Use selectedCommits directly, or filtered commits if nothing selected
   const container = document.getElementById('language-breakdown');

   if (selectedCommits.length === 0) {
       container.innerHTML = '';
       return;
   }

   const requiredCommits = selectedCommits.length ? selectedCommits : filterCommitsByTime();
   const lines = requiredCommits.flatMap(d => d.lines);

   const breakdown = d3.rollup(
       lines,
       v => v.length,
       d => d.type
   );

   container.innerHTML = '';
   for (const [language, count] of breakdown) {
       const proportion = count / lines.length;
       const formatted = d3.format('.1~%')(proportion);
       container.innerHTML += `
           <dt>${language}</dt>
           <dd>${count} lines (${formatted})</dd>
       `;
   }

   return breakdown;
}

function brushed(event) {
    brushSelection = event.selection;
    
    // Get filtered commits
    const filteredCommits = filterCommitsByTime();
    
    selectedCommits = !brushSelection
      ? []
      : filteredCommits.filter((commit) => {
          let min = { x: brushSelection[0][0], y: brushSelection[0][1] };
          let max = { x: brushSelection[1][0], y: brushSelection[1][1] };
          let x = xScale(commit.datetime);
          let y = yScale(commit.hourFrac);
  
          return x >= min.x && x <= max.x && y >= min.y && y <= max.y;
        });
        
    d3.selectAll('circle').classed('selected', d => selectedCommits.includes(d));
    updateSelectionCount();
    updateLanguageBreakdown();
}

function brushSelector() {
   const svg = document.querySelector('svg');
   d3.select(svg).call(d3.brush().on('start brush end', brushed));
   d3.select(svg).selectAll('.dots, .overlay ~ *').raise();
}

function updateScatterplot(filteredCommits) {
    if (filteredCommits.length === 0) {
        console.warn("No commits to display in scatterplot");
        d3.select('#chart').append('p')
          .text('No commits found in the selected time range');
        return;
    }
    const margin = { top: 10, right: 10, bottom: 30, left: 20 };
    
    const usableArea = {
        top: margin.top,
        right: width - margin.right,
        bottom: height - margin.bottom,
        left: margin.left,
        width: width - margin.left - margin.right,
        height: height - margin.top - margin.bottom,
    };
 
    d3.select('svg').remove(); // first clear the svg
    const svg = d3
        .select('#chart')
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('overflow', 'visible');
 
    xScale = d3
        .scaleTime()
        .domain(d3.extent(filteredCommits, (d) => d.datetime))
        .range([usableArea.left, usableArea.right])
        .nice();
 
    yScale = d3
        .scaleLinear()
        .domain([0, 24])
        .range([usableArea.bottom, usableArea.top]);
 
    const [minLines, maxLines] = d3.extent(filteredCommits, (d) => d.totalLines);
    const rScale = d3
        .scaleSqrt()
        .domain([minLines || 1, maxLines || 10]) // Add fallbacks for empty datasets
        .range([2, 30]);
 
    const gridlines = svg
        .append('g')
        .attr('class', 'gridlines')
        .attr('transform', `translate(${usableArea.left}, 0)`);
 
    gridlines.call(
        d3.axisLeft(yScale)
            .tickFormat('')
            .tickSize(-usableArea.width)
    );
 
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3
        .axisLeft(yScale)
        .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');
 
    svg.append('g')
        .attr('transform', `translate(0, ${usableArea.bottom})`)
        .call(xAxis);
 
    svg.append('g')
        .attr('transform', `translate(${usableArea.left}, 0)`)
        .call(yAxis);
 
    const dots = svg.append('g').attr('class', 'dots');
 
    // Use D3's join pattern with transitions for smooth animations
    dots.selectAll('circle')
        .data(filteredCommits)
        .join(
          // Enter selection - for new circles
          enter => enter.append('circle')
            .attr('cx', d => xScale(d.datetime))
            .attr('cy', d => yScale(d.hourFrac))
            .attr('r', 0) // Start with radius 0
            .attr('fill', 'steelblue')
            .style('fill-opacity', 0.7)
            .call(enter => enter.transition().duration(400) // Animate entry
              .attr('r', d => rScale(d.totalLines))),
          
          // Update selection - for existing circles
          update => update
            .call(update => update.transition().duration(200)
              .attr('cx', d => xScale(d.datetime))
              .attr('cy', d => yScale(d.hourFrac))
              .attr('r', d => rScale(d.totalLines))),
          
          // Exit selection - for circles being removed
          exit => exit
            .call(exit => exit.transition().duration(200)
              .attr('r', 0)
              .remove())
        )
        .on('mouseenter', (event, commit) => {
            d3.select(event.target).style('fill-opacity', 1);
            updateTooltipContent(commit);
            updateTooltipVisibility(true);
            updateTooltipPosition(event);
        })
        .on('mouseleave', (event) => {
            d3.select(event.target).style('fill-opacity', 0.7);
            updateTooltipContent({});
            updateTooltipVisibility(false);
        })
        .on('mousemove', (event) => {
            updateTooltipPosition(event);
        });
}

function updateFileVisualization(filteredCommits) {
    // Get all lines from filtered commits
    let lines = filteredCommits.flatMap((d) => d.lines);
    
    // Group lines by file
    let files = [];
    files = d3
      .groups(lines, (d) => d.file)
      .map(([name, lines]) => {
        return { name, lines };
      });
    
    // Sort files by number of lines (descending)
    files.sort((a, b) => b.lines.length - a.lines.length);
    
    // Create a color scale for file types
    let fileTypeColors = d3.scaleOrdinal(d3.schemeTableau10);
    
    // Select or create the files container
    let filesContainer = d3.select('#files-section');
    if (filesContainer.empty()) {
      filesContainer = d3.select('#chart')
        .append('div')
        .attr('id', 'files-section')
        .append('h2')
        .text('File Sizes')
        .node()
        .parentNode
        .append('dl')
        .attr('class', 'files');
    } else {
      filesContainer = filesContainer.select('.files');
    }
    
    // Clear existing content
    filesContainer.selectAll('div').remove();
    
    // Add new content
    let fileItems = filesContainer.selectAll('div')
      .data(files)
      .enter()
      .append('div');
    
    // Add file names with line count in small text
    fileItems.append('dt')
      .html(d => `<code>${d.name}</code><small>${d.lines.length} lines</small>`);
    
    // Add dots for each line, colored by file type
    fileItems.append('dd')
      .selectAll('div')
      .data(d => d.lines)
      .enter()
      .append('div')
      .attr('class', 'line')
      .style('background', d => fileTypeColors(d.type))
      .attr('title', d => `Line ${d.line}: ${d.length} characters (${d.type})`);
      
    // Add a legend for file types
    const allTypes = [...new Set(lines.map(d => d.type))];
    
    // Only create legend if it doesn't exist yet
    if (d3.select('#file-type-legend').empty()) {
      const legend = d3.select('#files-section')
        .append('div')
        .attr('id', 'file-type-legend')
        .attr('class', 'file-legend')
        .append('h3')
        .text('File Types')
        .node()
        .parentNode;
      
      const legendItems = legend.append('ul')
        .selectAll('li')
        .data(allTypes)
        .enter()
        .append('li');
        
      legendItems.append('span')
        .attr('class', 'color-swatch')
        .style('background', d => fileTypeColors(d));
        
      legendItems.append('span')
        .text(d => d);
    }
  }

function filterCommitsByTime() {
    const commitMaxTime = timeScale.invert(commitProgress);
    
    // Filter commits based on datetime
    const filteredCommits = commits.filter(commit => commit.datetime <= commitMaxTime);
    
    console.log("Filtered commits:", filteredCommits.length, "out of", commits.length);
    
    // Update the time display
    const selectedTime = d3.select('#selectedTime');
    selectedTime.text(commitMaxTime.toLocaleString('en', {
        dateStyle: "long",
        timeStyle: "short"
    }));
    
    return filteredCommits;
 }

function createScatterplot() {
   const filteredCommits = filterCommitsByTime();
   updateScatterplot(filteredCommits);
   updateFileVisualization(filteredCommits); // Add this line
}

function processCommits() {
   commits = d3
       .groups(data, (d) => d.commit)
       .map(([commit, lines]) => {
           let first = lines[0];
           let { author, date, time, timezone, datetime } = first;
           let ret = {
               id: commit,
               url: `https://github.com/rcheung03/portfolio/commit/${commit}`,
               author,
               date,
               time,
               timezone,
               datetime,
               hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
               totalLines: lines.length,
           };

           Object.defineProperty(ret, 'lines', {
               value: lines,
               enumerable: false,
               configurable: false,
               writable: false
           });

           return ret;
       });
       
   // Create time scale for the slider
   timeScale = d3.scaleTime()
       .domain([d3.min(commits, d => d.datetime), d3.max(commits, d => d.datetime)])
       .range([0, 100]);
}

function displayStats() {
   processCommits();

   const dl = d3.select('#stats').append('dl').attr('class', 'stats');

   dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
   dl.append('dd').text(data.length);

   dl.append('dt').text('COMMITS');
   dl.append('dd').text(commits.length);

   dl.append('dt').text('FILES');
   dl.append('dd').text(d3.group(data, d => d.file).size);

   dl.append('dt').text('MAX DEPTH');
   dl.append('dd').text(d3.max(data, d => d.depth));

   dl.append('dt').text('LONGEST LINE');
   dl.append('dd').text(d3.max(data, d => d.length));

   dl.append('dt').text('MAX LINES');
   const maxLines = d3.rollups(
       data,
       v => d3.max(v, d => d.line),
       d => d.file
   );
   dl.append('dd').text(d3.max(maxLines, d => d[1]));
}

function updateTimeDisplay() {
    commitProgress = Number(document.getElementById('commit-slider').value);
    
    // Update time display
    const selectedTime = d3.select('#selectedTime');
    selectedTime.text(timeScale.invert(commitProgress).toLocaleString('en', {
        dateStyle: "long",
        timeStyle: "short"
    }));
    
    // Filter commits and update visualizations
    const filteredCommits = filterCommitsByTime();
    updateScatterplot(filteredCommits);
    updateFileVisualization(filteredCommits); // Add this line
}

function setupSlider() {
    const slider = document.getElementById('commit-slider');
    if (slider) {
        slider.value = commitProgress;
        slider.addEventListener('input', updateTimeDisplay);
    }
    
    // Initialize the time display
    const selectedTime = d3.select('#selectedTime');
    if (timeScale) {
        selectedTime.text(timeScale.invert(commitProgress).toLocaleString('en', {
            dateStyle: "long",
            timeStyle: "short"
        }));
    }
}

async function loadData() {
    try {
       data = await d3.csv('loc.csv', (row) => ({
           ...row,
           line: Number(row.line),
           depth: Number(row.depth),
           length: Number(row.length),
           date: new Date(row.date + 'T00:00' + row.timezone),
           datetime: new Date(row.datetime),
       }));
       
       console.log("Loaded data:", data.length, "rows");
       
       if (data.length === 0) {
           console.error("No data loaded from loc.csv");
           document.getElementById('chart').innerHTML = "<p>Error: No data found in loc.csv</p>";
           return;
       }
       
       displayStats();
       processCommits();
       
       console.log("Processed commits:", commits.length, "commits");
       
       if (commits.length === 0) {
           console.error("No commits processed");
           document.getElementById('chart').innerHTML = "<p>Error: No commits found in the data</p>";
           return;
       }
       
       setupSlider();
       createScatterplot();
       brushSelector();
       
    } catch (error) {
       console.error("Error loading data:", error);
       document.getElementById('chart').innerHTML = "<p>Error loading data: " + error.message + "</p>";
    }
 }
 function setupScrollytelling() {
    // Determine important dates from commits
    const commitDates = commits.map(c => c.datetime).sort((a, b) => a - b);
    const earliestDate = commitDates[0];
    const latestDate = commitDates[commitDates.length - 1];
    
    // Create time points for each step
    const steps = d3.selectAll('.step');
    const totalSteps = steps.size();
    
    // Set up the intersection observer
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Mark this step as active
          d3.selectAll('.step').classed('active', false);
          d3.select(entry.target).classed('active', true);
          
          // Get the step number
          const stepNumber = +d3.select(entry.target).attr('data-step');
          const progress = (stepNumber - 1) / (totalSteps - 1) * 100;
          
          // Update the slider and visualization
          commitProgress = progress;
          updateTimeDisplay();
        }
      });
    }, {
      rootMargin: '-40% 0px -40% 0px',
      threshold: 0
    });
    
    // Observe all steps
    steps.each(function() {
      observer.observe(this);
    });
  }

document.addEventListener('DOMContentLoaded', async () => {
   await loadData();
});