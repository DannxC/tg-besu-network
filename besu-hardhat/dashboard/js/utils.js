/* eslint-env browser */
/**
 * Utilidades para conversões e cálculos do dashboard
 */

// Canvas dimensions: proporção 1:1.5 (altura:largura) para melhor visualização
// Latitude: -90 a +90 (180 graus de altura)
// Longitude: -180 a +180 (360 graus de largura)
const CANVAS_HEIGHT = 600;  // Representa latitude (-90 a +90)
const CANVAS_WIDTH = 900;   // Representa longitude (-180 a +180) - proporção 1:1.5
const MIN_LAT = -90;
const MAX_LAT = 90;
const MIN_LON = -180;
const MAX_LON = 180;

/**
 * Converte coordenadas lat/lon para pixels no canvas
 * @param {number} lat - Latitude (-90 a 90)
 * @param {number} lon - Longitude (-180 a 180)
 * @returns {{x: number, y: number}} Coordenadas em pixels
 */
function latLonToCanvas(lat, lon) {
  // Lat [-90, 90] -> Y [600, 0] (invertido porque Y cresce para baixo)
  const y = ((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)) * CANVAS_HEIGHT;
  
  // Lon [-180, 180] -> X [0, 900]
  const x = ((lon - MIN_LON) / (MAX_LON - MIN_LON)) * CANVAS_WIDTH;
  
  return { x, y };
}

/**
 * Converte pixels do canvas para coordenadas lat/lon
 * @param {number} x - Posição X no canvas
 * @param {number} y - Posição Y no canvas
 * @returns {{lat: number, lon: number}} Coordenadas geográficas
 */
function canvasToLatLon(x, y) {
  // X [0, 900] -> Lon [-180, 180]
  const lon = MIN_LON + (x / CANVAS_WIDTH) * (MAX_LON - MIN_LON);
  
  // Y [0, 600] -> Lat [90, -90] (invertido)
  const lat = MAX_LAT - (y / CANVAS_HEIGHT) * (MAX_LAT - MIN_LAT);
  
  return { lat, lon };
}

/**
 * Calcula o índice Z-Order para uma célula do grid
 * Implementa o algoritmo de interleaving de bits (Morton code)
 * 
 * @param {number} x - Índice X da célula (0 a 2^precision - 1)
 * @param {number} y - Índice Y da célula (0 a 2^precision - 1)
 * @param {number} precision - Precisão do geohash
 * @returns {number} Índice Z-Order
 */
function calculateZOrderIndex(x, y, precision) {
  let index = 0;
  
  // Interleaving de bits: alternamos bits de Y e X
  // Precisão determina quantos bits processar
  for (let i = 0; i < precision; i++) {
    // Extrair bit na posição i (da direita para esquerda)
    const bitX = (x >> i) & 1;
    const bitY = (y >> i) & 1;
    
    // Inserir bits no índice: Y no bit mais significativo, X no menos
    // Shift 2 posições para abrir espaço para 2 bits
    index |= (bitY << (2 * i + 1)) | (bitX << (2 * i));
  }
  
  return index;
}

/**
 * Formata número para hexadecimal com prefixo 0x
 * @param {number} num - Número a formatar
 * @returns {string} Número em hexadecimal (ex: "0x1A")
 */
function toHex(num) {
  return '0x' + num.toString(16).toUpperCase();
}

/**
 * Valida se a precision é válida (par e entre 2-16)
 * @param {number} precision - Precision a validar
 * @returns {boolean} True se válida
 */
function isValidPrecision(precision) {
  return precision >= 2 && precision <= 16 && precision % 2 === 0;
}

/**
 * Calcula o tamanho de cada célula do grid em pixels
 * @param {number} precision - Precision do geohash
 * @returns {{width: number, height: number}} Dimensões da célula em pixels
 */
function getCellSize(precision) {
  const gridCount = Math.pow(2, precision);
  return {
    width: CANVAS_WIDTH / gridCount,
    height: CANVAS_HEIGHT / gridCount
  };
}

/**
 * Calcula quantas células existem no grid para uma dada precision
 * @param {number} precision - Precision do geohash
 * @returns {number} Número de células por lado (total = result^2)
 */
function getGridCount(precision) {
  return Math.pow(2, precision);
}

/**
 * Converte índice de célula (gridX, gridY) para coordenadas de canvas (pixel)
 * @param {number} gridX - Índice X da célula
 * @param {number} gridY - Índice Y da célula
 * @param {{width: number, height: number}} cellSize - Dimensões de cada célula
 * @returns {{x: number, y: number}} Coordenadas do canto superior esquerdo
 */
function gridToCanvas(gridX, gridY, cellSize) {
  return {
    x: gridX * cellSize.width,
    y: gridY * cellSize.height
  };
}

// Exportar para uso global no browser
if (typeof window !== 'undefined') {
  window.GeohashUtils = {
    latLonToCanvas,
    canvasToLatLon,
    calculateZOrderIndex,
    toHex,
    isValidPrecision,
    getCellSize,
    getGridCount,
    gridToCanvas,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    MIN_LAT,
    MAX_LAT,
    MIN_LON,
    MAX_LON
  };
}

