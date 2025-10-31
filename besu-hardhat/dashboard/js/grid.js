/* eslint-env browser */
/**
 * Módulo de renderização do grid de geohashes
 */

let canvas = null;
let ctx = null;
let currentPrecision = 8;

/**
 * Inicializa o módulo de grid com o canvas
 * @param {HTMLCanvasElement} canvasElement - Elemento canvas
 */
function initGrid(canvasElement) {
  canvas = canvasElement;
  ctx = canvas.getContext('2d');
}

/**
 * Desenha o grid completo baseado na precision
 * @param {number} precision - Precision do geohash (2-16, par)
 */
function drawGrid(precision) {
  if (!ctx) {
    console.error('Grid não inicializado! Chame initGrid() primeiro.');
    return;
  }

  currentPrecision = precision;
  
  // Limpar canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Preencher fundo branco
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  const gridCount = GeohashUtils.getGridCount(precision);
  const cellSize = GeohashUtils.getCellSize(precision);
  
  // Desenhar células e bordas
  drawCells(gridCount, cellSize);
  
  // Desenhar labels hexadecimais (apenas se precision <= 4)
  if (precision <= 4) {
    drawGeohashLabels(gridCount, cellSize);
  }
  
  // Desenhar border externa mais grossa
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.setLineDash([]); // SEMPRE linhas sólidas no grid
  ctx.strokeRect(0, 0, canvas.width, canvas.height);
  
  // GARANTIR que lineDash está resetado após desenhar o grid
  ctx.setLineDash([]);
  ctx.lineWidth = 1;
}

/**
 * Desenha as células do grid com bordas
 * @param {number} gridCount - Número de células por lado
 * @param {{width: number, height: number}} cellSize - Dimensões de cada célula
 */
function drawCells(gridCount, cellSize) {
  ctx.strokeStyle = '#CCCCCC';
  ctx.lineWidth = 1;
  ctx.setLineDash([]); // SEMPRE linhas sólidas
  
  // Linhas verticais
  for (let i = 0; i <= gridCount; i++) {
    const x = i * cellSize.width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  
  // Linhas horizontais
  for (let i = 0; i <= gridCount; i++) {
    const y = i * cellSize.height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

/**
 * Desenha os labels hexadecimais em cada célula
 * @param {number} gridCount - Número de células por lado
 * @param {{width: number, height: number}} cellSize - Dimensões de cada célula
 */
function drawGeohashLabels(gridCount, cellSize) {
  ctx.fillStyle = '#666666';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  
  for (let gridY = 0; gridY < gridCount; gridY++) {
    for (let gridX = 0; gridX < gridCount; gridX++) {
      // Calcular Z-Order index
      const zOrderIndex = GeohashUtils.calculateZOrderIndex(gridX, gridY, currentPrecision);
      const hexLabel = GeohashUtils.toHex(zOrderIndex);
      
      // Posição do label (canto superior esquerdo com pequeno padding)
      const x = gridX * cellSize.width + 3;
      const y = gridY * cellSize.height + 3;
      
      // Desenhar label
      ctx.fillText(hexLabel, x, y);
    }
  }
}

/**
 * Desenha um ponto no canvas
 * @param {number} x - Coordenada X
 * @param {number} y - Coordenada Y
 * @param {string} color - Cor do ponto
 * @param {number} radius - Raio do ponto
 */
function drawPoint(x, y, color = '#FF0000', radius = 5) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Desenha uma linha entre dois pontos
 * @param {number} x1 - X inicial
 * @param {number} y1 - Y inicial
 * @param {number} x2 - X final
 * @param {number} y2 - Y final
 * @param {string} color - Cor da linha
 * @param {number} width - Largura da linha
 */
function drawLine(x1, y1, x2, y2, color = '#0000FF', width = 2) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/**
 * Desenha um polígono
 * @param {Array<{x: number, y: number}>} points - Array de pontos
 * @param {string} strokeColor - Cor da borda
 * @param {string} fillColor - Cor de preenchimento (opcional)
 */
function drawPolygon(points, strokeColor = '#0000FF', fillColor = null) {
  if (points.length < 3) return;
  
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  
  if (fillColor) {
    ctx.fillStyle = fillColor;
  }
  
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  
  ctx.closePath();
  
  if (fillColor) {
    ctx.fill();
  }
  ctx.stroke();
}

/**
 * Destaca uma célula do grid
 * @param {number} gridX - Índice X da célula
 * @param {number} gridY - Índice Y da célula
 * @param {string} color - Cor de destaque
 */
function highlightCell(gridX, gridY, color = 'rgba(255, 255, 0, 0.3)') {
  const cellSize = GeohashUtils.getCellSize(currentPrecision);
  const pos = GeohashUtils.gridToCanvas(gridX, gridY, cellSize);
  
  ctx.fillStyle = color;
  ctx.fillRect(pos.x, pos.y, cellSize.width, cellSize.height);
}

/**
 * Destaca uma célula pelo geohash (Z-Order index)
 * @param {number} zOrderIndex - Índice Z-Order da célula
 * @param {number} precision - Precision do grid
 * @param {string} color - Cor de destaque
 */
function highlightCellByGeohash(zOrderIndex, precision, color = 'rgba(255, 0, 0, 0.3)') {
  // Converter Z-Order index para coordenadas de grid (gridX, gridY)
  const gridCount = Math.pow(2, precision);
  let gridX = 0;
  let gridY = 0;
  
  // Deinterleaving de bits: extrair X e Y do índice Z-Order
  for (let i = 0; i < precision; i++) {
    const bitX = (zOrderIndex >> (2 * i)) & 1;
    const bitY = (zOrderIndex >> (2 * i + 1)) & 1;
    gridX |= (bitX << i);
    gridY |= (bitY << i);
  }
  
  // Validar se está dentro dos limites
  if (gridX >= 0 && gridX < gridCount && gridY >= 0 && gridY < gridCount) {
    highlightCell(gridX, gridY, color);
    return true;
  }
  return false;
}

/**
 * Desenha um retângulo no canvas (bounding box)
 * @param {number} minLat - Latitude mínima
 * @param {number} minLon - Longitude mínima
 * @param {number} maxLat - Latitude máxima
 * @param {number} maxLon - Longitude máxima
 * @param {string} color - Cor do retângulo
 * @param {number} lineWidth - Largura da linha
 */
function drawBoundingBox(minLat, minLon, maxLat, maxLon, color = 'rgba(255, 0, 0, 0.8)', lineWidth = 3) {
  // Converter lat/lon para coordenadas do canvas
  const topLeft = GeohashUtils.latLonToCanvas(maxLat, minLon);
  const bottomRight = GeohashUtils.latLonToCanvas(minLat, maxLon);
  
  const width = bottomRight.x - topLeft.x;
  const height = bottomRight.y - topLeft.y;
  
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(topLeft.x, topLeft.y, width, height);
}

// Exportar para uso global no browser
if (typeof window !== 'undefined') {
  window.GeohashGrid = {
    initGrid,
    drawGrid,
    drawPoint,
    drawLine,
    drawPolygon,
    highlightCell,
    highlightCellByGeohash,
    drawBoundingBox
  };
}

