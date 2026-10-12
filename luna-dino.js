
/* Colors for Gantt blocks and process labels. */
const COLORS = [
    '#38bdf8', '#f472b6', '#facc15', '#4ade80', '#a78bfa',
    '#fb923c', '#2dd4bf', '#f87171', '#c084fc', '#34d399'
];
const colorFor = id => COLORS[(id - 1) % COLORS.length];



/* Rounding decimals by 2 */
function smartRound(num) {
    const rounded = Math.round(num * 100) / 100;
    if (Number.isInteger(rounded))  return rounded.toString();
    if ((rounded * 10) % 1 === 0)   return rounded.toFixed(1);
    return rounded.toFixed(2);
}


/*INPUT TABLE BUILDER*/
function buildInputTable() {
    const n = Math.max(
        1,
        Math.min(10, parseInt(document.getElementById('numProcesses').value, 10) || 1)
    );
    const tbody = document.getElementById('inputBody');

    // Snapshot existing values
    const oldValues = [];
    tbody.querySelectorAll('tr').forEach(tr => {
        const inputs = tr.querySelectorAll('input');
        oldValues.push({
            arrival:  inputs[0]?.value ?? '',
            burst:    inputs[1]?.value ?? '',
            priority: inputs[2]?.value ?? ''
        });
    });

    tbody.innerHTML = '';

    for (let i = 0; i < n; i++) {
        const prev = oldValues[i] || {};

        const arrival  = prev.arrival  ?? '';
        const burst    = prev.burst    ?? '';
        const priority = prev.priority ?? '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="pid" style="color:${colorFor(i + 1)}">P${i + 1}</td>
            <td><input type="number" min="0" value="${arrival}"
                        placeholder="0" data-field="arrival"></td>
            <td><input type="number" min="1" value="${burst}"
                        placeholder="0" data-field="burst"></td>
            <td><input type="number" min="1" value="${priority}"
                        placeholder="0" data-field="priority"></td>
        `;
        tbody.appendChild(tr);
    }
}

/* Rebuild the table whenever the number of processes changes. */
document.getElementById('numProcesses')
    .addEventListener('input', buildInputTable);


/* RENDER: GANTT CHART */
function renderGantt(segments) {
    if (!segments.length) return '';

    const total = segments[segments.length - 1].end || 1;

    let blocks = '';
    segments.forEach(seg => {
        const width = ((seg.end - seg.start) / total) * 100;
        const label = seg.id === 0 ? 'IDLE' : 'P' + seg.id;
        const bg    = seg.id === 0 ? '#475569' : colorFor(seg.id);

        blocks += `<div class="gantt-block" style="width:${width}%;background:${bg}">${label}</div>`;
    });

    let tl = '';
    segments.forEach((seg, i) => {
        const width = ((seg.end - seg.start) / total) * 100;
        tl += `<span style="width:${width}%;text-align:left;padding-left:2px">${seg.start}</span>`;
        if (i === segments.length - 1) tl += `<span style="width:0">${seg.end}</span>`;
    });

    return `
        <div class="chart-label">Gantt Chart</div>
        <div class="gantt">${blocks}</div>
        <div class="gantt-timeline">${tl}</div>`;
}


/*RENDER: RESULTS TABLE*/
function renderTable(rows, showPriority = true) {
    let head = '<tr><th>Process</th><th>Arrival Time</th><th>Burst Time</th>';
    if (showPriority) head += '<th>Priority</th>';
    head += '<th>Completion Time</th><th>Turnaround Time</th><th>Waiting Time</th></tr>';

    const body = rows.map(r => `
        <tr>
            <td><b style="color:${colorFor(r.id)}">P${r.id}</b></td>
            <td>${r.arrival}</td>
            <td>${r.burst}</td>
            ${showPriority ? `<td>${r.priority}</td>` : ''}
            <td>${r.completion}</td>
            <td>${r.turnaround}</td>
            <td>${r.waiting}</td>
        </tr>`).join('');

    return `<table>${head}${body}</table>`;
}


/* RENDER: (AWT / ATT)  */
function renderStats(awt, att) {
    return `
        <div class="stats">
            <div class="stat-card">
                <div class="label">Average Waiting Time (AWT)</div>
                <div class="value">${smartRound(awt)}</div>
            </div>
            <div class="stat-card">
                <div class="label">Average Turnaround Time (ATT)</div>
                <div class="value">${smartRound(att)}</div>
            </div>
        </div>`;
}

/* RENDER: READY QUEUEn*/
function renderReadyQueue(processSequence) {
    if (!processSequence || processSequence.length === 0) return '';

    const cells = processSequence.map(id =>
        `<div class="rq-cell">P${id}</div>`
    ).join('');

    return `
        <div class="chart-label">Ready Queue</div>
        <div class="ready-queue">${cells}</div>`;
}




/* ALGORITHM 1: FCFS (FIRST-COME, FIRST-SERVED) */
function fcfsScheduling(procs) {
    // 1. Sort by arrival time (tie-break: original process id)
    const sorted = procs
        .map(p => ({ ...p }))
        .sort((a, b) => a.arrival - b.arrival || a.id - b.id);

    let time = 0;
    const segments = [];
    const rows     = [];

    sorted.forEach(p => {
        // 2. CPU is free but the next process hasn't arrived yet -> IDLE
        if (p.arrival > time) {
            segments.push({ id: 0, start: time, end: p.arrival });
            time = p.arrival;
        }

        // 3. Run the process to completion (non-preemptive)
        const start      = time;
        const end        = time + p.burst;
        const waiting    = start - p.arrival;
        const turnaround = end   - p.arrival;

        segments.push({ id: p.id, start, end });
        rows.push({
            id: p.id,
            burst: p.burst,
            arrival: p.arrival,
            priority: p.priority,
            completion: end,
            waiting,
            turnaround
        });

        time = end;
    });

    // 4. Averages
    const awt = rows.reduce((s, r) => s + r.waiting, 0)    / rows.length;
    const att = rows.reduce((s, r) => s + r.turnaround, 0) / rows.length;

    // Ready queue order = execution order
    const processSequence = rows.map(r => r.id);

    // Show the results table in P1, P2, P3... order (same as Round Robin)
    rows.sort((a, b) => a.id - b.id);

    return { rows, segments, awt, att, processSequence };
}


/* ALGORITHM 2: SJF (NON-PREEMPTIVE) */
function sjfScheduling(procs) {
    const remaining = procs.map(p => ({ ...p, done: false }));
    const n = remaining.length;

    let time = 0;
    let completed = 0;
    const segments = [];
    const rows     = [];

    while (completed < n) {
        // 1. Processes that already arrived and are not finished
        const ready = remaining.filter(p => !p.done && p.arrival <= time);

        // 2. Nobody is ready -> CPU idles until the next arrival
        if (ready.length === 0) {
            const nextArrival = Math.min(
                ...remaining.filter(p => !p.done).map(p => p.arrival)
            );
            segments.push({ id: 0, start: time, end: nextArrival });
            time = nextArrival;
            continue;
        }

        // 3. Pick the shortest burst (ties: earlier arrival, then lower id)
        ready.sort((a, b) =>
            a.burst   - b.burst   ||
            a.arrival - b.arrival ||
            a.id      - b.id
        );
        const p = ready[0];

        // 4. Run it to completion
        const start      = time;
        const end        = time + p.burst;
        const waiting    = start - p.arrival;
        const turnaround = end   - p.arrival;

        segments.push({ id: p.id, start, end });
        rows.push({
            id: p.id,
            burst: p.burst,
            arrival: p.arrival,
            priority: p.priority,
            completion: end,
            waiting,
            turnaround
        });

        p.done = true;
        completed++;
        time = end;
    }

    const awt = rows.reduce((s, r) => s + r.waiting, 0)    / rows.length;
    const att = rows.reduce((s, r) => s + r.turnaround, 0) / rows.length;
    const processSequence = rows.map(r => r.id);

    rows.sort((a, b) => a.id - b.id);

    return { rows, segments, awt, att, processSequence };
}


/* ALGORITHM 3: PRIORITY SCHEDULING (NON-PREEMPTIVE) */
function priorityScheduling(procs) {
    const remaining = procs.map(p => ({ ...p, done: false }));
    
    let time = 0;  /* Overall Time */
    let completed = 0;
    const n = remaining.length /* Number of processes */
    const segments = [];  /* For Gantt Chart */
    const rows     = [];

    while (completed < n) {
        const ready = remaining.filter(p => !p.done && p.arrival <= time);
        if (ready.length === 0) {
            const nextArrival = Math.min(
                ...remaining.filter(p => !p.done).map(p => p.arrival) /* Find the next process that will arrive */
            );
            if (nextArrival > time) {  /* CPU is idle until the next process arrives */
                segments.push({ id: 0, start: time, end: nextArrival });
                time = nextArrival;
            }
            continue;
        }
        ready.sort((a, b) =>  /* Sort by priority, then arrival time, then process ID */
            a.priority - b.priority ||  
            a.arrival  - b.arrival  ||
            a.id       - b.id
        );
        const p = ready[0];


        const start      = time;
        const end        = time + p.burst;      /* Completion time */
        const turnaround = end  - p.arrival;    /* Turnaround time */
        const waiting = turnaround - p.burst;   /* Waiting time */

        segments.push({ id: p.id, start, end });
        rows.push({
            id: p.id,
            burst: p.burst,
            arrival: p.arrival,
            priority: p.priority,
            completion: end,
            waiting,
            turnaround
        });

        p.done = true;
        completed++;
        time = end;
    }
    const att = rows.reduce((s, r) => s + r.turnaround, 0) / rows.length;
    const awt = rows.reduce((s, r) => s + r.waiting, 0)    / rows.length;

    const processSequence = rows.map(r => r.id); /* Order of execution for Ready Queue */
    rows.sort((a, b) => a.id - b.id);
    return { rows, segments, awt, att, processSequence };
}


/* ALGORITHM 4: ROUND ROBIN */
function roundRobin(procs, quantum) {

    const list = procs              /* Create a copy of the processes */
        .map(p => ({                /* with additional fields for remaining burst time and end time and */
            id: p.id,               /* Original data won't change */
            burst: p.burst,
            arrival: p.arrival,
            remaining: p.burst,
            endTime: -1
        }))
        .sort((a, b) => a.arrival - b.arrival || a.id - b.id);  

    const byId = Object.fromEntries(list.map(p => [p.id, p])); 
    let time      = 0;             /* Overall Time */
    let completed = 0;
    const n       = list.length; /* Number of processes */
    const queue   = [];          /* Ready Queue */
    const segments = [];         /* For Gantt Chart */

    let nextToArrive = 0;
    while (nextToArrive < n && list[nextToArrive].arrival <= time) {   /* Add all processes that  */
        queue.push(list[nextToArrive].id);                             /* have already arrived to the queue */
        nextToArrive++;
    }

    while (completed < n) {     
        if (queue.length === 0) {
            if (nextToArrive < n) {                       /* Find the next process that will arrive */
                const nextArrival = list[nextToArrive].arrival;     

                if (nextArrival > time) {
                    segments.push({ id: 0, start: time, end: nextArrival });
                    time = nextArrival;
                }
                while (nextToArrive < n && list[nextToArrive].arrival <= time) {  
                    queue.push(list[nextToArrive].id);  
                    nextToArrive++;
                }
            }
            continue;
        }

        const id = queue.shift();                       /* Get the next process from the queue */
        const p  = byId[id];                            /* Get the process object by its ID */
        const run   = Math.min(p.remaining, quantum);   /* Run the process */
        
        const start = time;
        const end   = time + run;

        const last = segments[segments.length - 1]; 
        if (last && last.id === id && last.end === start) {  
            last.end = end;
        } else {
            segments.push({ id, start, end }); 
        }

        p.remaining -= run;
        time = end;

        while (nextToArrive < n && list[nextToArrive].arrival <= time) { /* Add all processes that  */
            queue.push(list[nextToArrive].id);                           /* have arrived before current process comes */
            nextToArrive++;                                              /* comes back to the ready queue */
        }

        if (p.remaining > 0) {
            queue.push(id);                 /* If the process is not finished, add it back to the queue */
        } 
        else {
            p.endTime = time;
            completed++;
        }
    }

    const rows = list.map(p => {                        /* Calculate waiting time and turnaround time */
        const turnaround = p.endTime - p.arrival;       /* turnaround time for each process */
        const waiting    = turnaround - p.burst;
        return {
            id: p.id,
            burst: p.burst,
            arrival: p.arrival,
            priority: '-',
            completion: p.endTime,
            waiting,
            turnaround
        };
    }).sort((a, b) => a.id - b.id);  

    const att = rows.reduce((s, r) => s + r.turnaround, 0) / rows.length;
    const awt = rows.reduce((s, r) => s + r.waiting, 0)    / rows.length;  

    const processSequence = segments
        .filter(s => s.id !== 0)  
        .map(s => s.id);            /* Order of execution for Ready Queue */

    return { rows, segments, awt, att, processSequence };
}



/* PARSE INPUT */
function parseInput() {
    const errBox = document.getElementById('errBox');
    errBox.textContent = '';

    const q = parseInt(document.getElementById('quantum').value, 10);
    const rows = document.querySelectorAll('#inputBody tr');

    if (rows.length === 0)  return err('No processes defined.');
    if (!q || q < 1)        return err('Time quantum must be at least 1.');

    const procs = [];
    for (let i = 0; i < rows.length; i++) {
        const arrivalRaw  = rows[i].querySelector('[data-field="arrival"]').value.trim();
        const burstRaw    = rows[i].querySelector('[data-field="burst"]').value.trim();
        const priorityRaw = rows[i].querySelector('[data-field="priority"]').value.trim();

        if (arrivalRaw  === '') return err(`P${i + 1}: arrival time is required (enter 0 if it arrives first).`);
        if (burstRaw    === '') return err(`P${i + 1}: burst time is required.`);
        if (priorityRaw === '') return err(`P${i + 1}: priority is required.`);

        const arrival  = parseInt(arrivalRaw, 10);
        const burst    = parseInt(burstRaw, 10);
        const priority = parseInt(priorityRaw, 10);

        if (isNaN(arrival)  || arrival < 0)   return err(`P${i + 1}: arrival time must be ≥ 0.`);
        if (isNaN(burst)    || burst < 1)     return err(`P${i + 1}: burst time must be ≥ 1.`);
        if (isNaN(priority) || priority < 1)  return err(`P${i + 1}: priority must be ≥ 1.`);

        procs.push({ id: i + 1, burst, arrival, priority });
    }

    return { procs, q };

    function err(msg) { errBox.textContent = '⚠ ' + msg; return null; }
}

/* RUN ALL and Display results */
function runAll() {
    const parsed = parseInput();
    if (!parsed) return;
    const { procs, q } = parsed;

    /* First-Come, First-Served */
    const fcfs = fcfsScheduling(procs);
    document.getElementById('fcfsOutput').innerHTML =
        renderReadyQueue(fcfs.processSequence) +
        renderGantt(fcfs.segments) +
        renderTable(fcfs.rows, false) +
        renderStats(fcfs.awt, fcfs.att);

    /* Shortest Job First (Non-Preemptive) */
    const sjf = sjfScheduling(procs);
    document.getElementById('sjfOutput').innerHTML =
        renderReadyQueue(sjf.processSequence) +
        renderGantt(sjf.segments) +
        renderTable(sjf.rows, false) +
        renderStats(sjf.awt, sjf.att);

    /* Priority Scheduling */
    const pr = priorityScheduling(procs);
    document.getElementById('priorityOutput').innerHTML =
        renderReadyQueue(pr.processSequence) +
        renderGantt(pr.segments) +
        renderTable(pr.rows, true) +
        renderStats(pr.awt, pr.att);

    /*Round Robin */
    const rr = roundRobin(procs, q);
    document.getElementById('rrOutput').innerHTML =
        `<p style="color:#6b7280;font-size:0.85rem;margin:0 0 8px 0">
            Time Quantum = <b>${q}</b>
         </p>` +
        renderReadyQueue(rr.processSequence) +
        renderGantt(rr.segments) +
        renderTable(rr.rows, false) +
        renderStats(rr.awt, rr.att);
}


/* LOAD SAMPLE DATA (if user does not want to input manually)*/
function loadSample() {
    const samples = [
        { burst: 5, arrival: 0, priority: 3 },
        { burst: 3, arrival: 1, priority: 1 },
        { burst: 8, arrival: 2, priority: 2 },
        { burst: 6, arrival: 3, priority: 4 }
    ];

    document.getElementById('numProcesses').value = samples.length;
    document.getElementById('quantum').value = 2;
    buildInputTable();

    const rows = document.querySelectorAll('#inputBody tr');
    rows.forEach((tr, i) => {
        const s = samples[i];
        tr.querySelector('[data-field="arrival"]').value  = s.arrival;
        tr.querySelector('[data-field="burst"]').value    = s.burst;
        tr.querySelector('[data-field="priority"]').value = s.priority;
    });
}


/* CLEAR ALL Inputs */
function clearAll() {
    document.getElementById('numProcesses').value = '';
    document.getElementById('quantum').value      = '';
    document.getElementById('inputBody').innerHTML = '';
    document.getElementById('errBox').textContent = '';

    document.getElementById('priorityOutput').innerHTML =
        '<div class="placeholder">Solve to see results.</div>';
    document.getElementById('rrOutput').innerHTML =
        '<div class="placeholder">Solve to see results.</div>';
    document.getElementById('fcfsOutput').innerHTML =
        '<div class="placeholder">Solve to see results.</div>';
    document.getElementById('sjfOutput').innerHTML =
        '<div class="placeholder">Solve to see results.</div>';
}

