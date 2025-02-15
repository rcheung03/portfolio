let data = [];
let commits = [];
let brushSelection = null;
let xScale, yScale;

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
   tooltip.style.left = (event.pageX + 5) + 'px';
   tooltip.style.top = (event.pageY + 5) + 'px';
}

function isCommitSelected(commit) {
   if (!brushSelection) return false;
   
   const x = xScale(commit.datetime);
   const y = yScale(commit.hourFrac);
   
   return x >= brushSelection[0][0] && 
          x <= brushSelection[1][0] && 
          y >= brushSelection[0][1] && 
          y <= brushSelection[1][1];
}

function updateSelectionCount() {
   const selectedCommits = brushSelection ? commits.filter(isCommitSelected) : [];
   const countElement = document.getElementById('selection-count');
   countElement.textContent = `${selectedCommits.length || 'No'} commits selected`;
   return selectedCommits;
}

function updateLanguageBreakdown() {
   const selectedCommits = brushSelection ? commits.filter(isCommitSelected) : [];
   const container = document.getElementById('language-breakdown');

   if (selectedCommits.length === 0) {
       container.innerHTML = '';
       return;
   }

   const requiredCommits = selectedCommits.length ? selectedCommits : commits;
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
   d3.selectAll('circle').classed('selected', d => isCommitSelected(d));
   updateSelectionCount();
   updateLanguageBreakdown();
}

function brushSelector() {
   const svg = document.querySelector('svg');
   d3.select(svg).call(d3.brush().on('start brush end', brushed));
   d3.select(svg).selectAll('.dots, .overlay ~ *').raise();
}

function createScatterplot() {
   const margin = { top: 10, right: 10, bottom: 30, left: 20 };
   
   const usableArea = {
       top: margin.top,
       right: width - margin.right,
       bottom: height - margin.bottom,
       left: margin.left,
       width: width - margin.left - margin.right,
       height: height - margin.top - margin.bottom,
   };

   const svg = d3
       .select('#chart')
       .append('svg')
       .attr('viewBox', `0 0 ${width} ${height}`)
       .style('overflow', 'visible');

   xScale = d3
       .scaleTime()
       .domain(d3.extent(commits, (d) => d.datetime))
       .range([usableArea.left, usableArea.right])
       .nice();

   yScale = d3
       .scaleLinear()
       .domain([0, 24])
       .range([usableArea.bottom, usableArea.top]);

   const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
   const rScale = d3
       .scaleSqrt()
       .domain([minLines, maxLines])
       .range([2, 30]);

   const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

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

   dots.selectAll('circle')
       .data(sortedCommits)
       .join('circle')
       .attr('cx', (d) => xScale(d.datetime))
       .attr('cy', (d) => yScale(d.hourFrac))
       .attr('r', (d) => rScale(d.totalLines))
       .attr('fill', 'steelblue')
       .style('fill-opacity', 0.7)
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

async function loadData() {
   data = await d3.csv('loc.csv', (row) => ({
       ...row,
       line: Number(row.line),
       depth: Number(row.depth),
       length: Number(row.length),
       date: new Date(row.date + 'T00:00' + row.timezone),
       datetime: new Date(row.datetime),
   }));

   displayStats();
   processCommits();
   createScatterplot();
   brushSelector();
}

document.addEventListener('DOMContentLoaded', async () => {
   await loadData();
});