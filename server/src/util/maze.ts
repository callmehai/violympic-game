/**
 * maze.ts — sinh mê cung 2D + tiện ích duyệt đường (cho Game 2 "Vượt Ải").
 *
 * Sinh bằng recursive-backtracker (perfect maze: 1 đường giữa 2 ô bất kỳ), rồi
 * "braid" (đục thêm vài tường) để tạo 2-3 lối vòng → có vài tuyến tới đích.
 * Lưới hiển thị có kích thước LẺ: ô toạ độ chẵn là tường, ô lẻ là hành lang.
 */

/** grid: 0 = tường, 1 = lối đi. start/exit là index ô (r*cols + c). */
export interface GenMaze {
  rows: number;
  cols: number;
  grid: number[]; // length rows*cols, 0|1
  start: number;
  exit: number;
}

const DIRS4 = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/**
 * Sinh mê cung rows×cols (sẽ ép về số LẺ ≥ 5). braid = số tường đục thêm để tạo lối vòng.
 * rand: hàm [0,1) (mặc định Math.random) để mỗi phiên một mê cung khác.
 */
export function genMaze(
  rowsIn: number,
  colsIn: number,
  braid: number,
  rand: () => number = Math.random,
): GenMaze {
  const rows = Math.max(5, rowsIn % 2 === 0 ? rowsIn + 1 : rowsIn);
  const cols = Math.max(5, colsIn % 2 === 0 ? colsIn + 1 : colsIn);
  const idx = (r: number, c: number) => r * cols + c;
  const grid = new Array<number>(rows * cols).fill(0); // toàn tường

  // --- Recursive backtracker (bước 2 ô để chừa tường giữa các hành lang) ---
  const stack: Array<[number, number]> = [[1, 1]];
  grid[idx(1, 1)] = 1;
  while (stack.length) {
    const [r, c] = stack[stack.length - 1];
    const nbrs: Array<[number, number]> = [];
    for (const [dr, dc] of DIRS4) {
      const nr = r + dr * 2;
      const nc = c + dc * 2;
      if (nr > 0 && nr < rows - 1 && nc > 0 && nc < cols - 1 && grid[idx(nr, nc)] === 0) {
        nbrs.push([nr, nc]);
      }
    }
    if (nbrs.length === 0) {
      stack.pop();
      continue;
    }
    const [nr, nc] = nbrs[Math.floor(rand() * nbrs.length)];
    grid[idx(nr, nc)] = 1;
    grid[idx((r + nr) / 2, (c + nc) / 2)] = 1; // đục tường giữa
    stack.push([nr, nc]);
  }

  // --- Braid: đục thêm vài tường nằm giữa 2 hành lang để tạo lối vòng ---
  let added = 0;
  let guard = 0;
  while (added < braid && guard < braid * 60 + 200) {
    guard++;
    const r = 1 + Math.floor(rand() * (rows - 2));
    const c = 1 + Math.floor(rand() * (cols - 2));
    if (grid[idx(r, c)] !== 0) continue; // phải là tường
    // chỉ đục nếu nó ngăn giữa 2 hành lang đối diện (ngang hoặc dọc)
    const horiz = grid[idx(r, c - 1)] === 1 && grid[idx(r, c + 1)] === 1;
    const vert = grid[idx(r - 1, c)] === 1 && grid[idx(r + 1, c)] === 1;
    if (horiz || vert) {
      grid[idx(r, c)] = 1;
      added++;
    }
  }

  const start = idx(1, 1);
  const exit = idx(rows - 2, cols - 2);
  return { rows, cols, grid, start, exit };
}

/** BFS: từ `from` tới được `to` không, qua các ô `passable(index)===true`. */
export function reachable(
  rows: number,
  cols: number,
  from: number,
  to: number,
  passable: (index: number) => boolean,
): boolean {
  if (from === to) return true;
  const seen = new Uint8Array(rows * cols);
  const queue: number[] = [from];
  seen[from] = 1;
  while (queue.length) {
    const cur = queue.shift() as number;
    const r = Math.floor(cur / cols);
    const c = cur % cols;
    for (const [dr, dc] of DIRS4) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const ni = nr * cols + nc;
      if (seen[ni]) continue;
      if (ni !== to && !passable(ni)) continue;
      if (ni === to) return true;
      seen[ni] = 1;
      queue.push(ni);
    }
  }
  return false;
}

/** Đường ngắn nhất (mảng index từ from→to) qua ô open===1; [] nếu không tới. */
export function shortestPath(rows: number, cols: number, grid: number[], from: number, to: number): number[] {
  const prev = new Int32Array(rows * cols).fill(-1);
  const seen = new Uint8Array(rows * cols);
  const queue: number[] = [from];
  seen[from] = 1;
  while (queue.length) {
    const cur = queue.shift() as number;
    if (cur === to) break;
    const r = Math.floor(cur / cols);
    const c = cur % cols;
    for (const [dr, dc] of DIRS4) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const ni = nr * cols + nc;
      if (seen[ni] || grid[ni] !== 1) continue;
      seen[ni] = 1;
      prev[ni] = cur;
      queue.push(ni);
    }
  }
  if (!seen[to]) return [];
  const path: number[] = [];
  let cur = to;
  while (cur !== -1) {
    path.push(cur);
    cur = prev[cur];
  }
  return path.reverse();
}
