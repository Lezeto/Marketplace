// Catálogo central de la aplicación: marca, tipos de aviso, categorías,
// regiones y comunas de Chile, tipos de precio, condición y envío.
// Es la única fuente de verdad compartida por el frontend; el backend
// (api/gamexapi.js) mantiene copias mínimas de los códigos para validar.

export const BRAND = 'LaFeria' // Marca provisional — cambiar aquí renombra toda la UI.
export const BRAND_TAGLINE = 'Compra, vende y contrata en Chile'

export const LISTING_TYPES = [
  { code: 'producto', label: 'Producto' },
  { code: 'servicio', label: 'Servicio' },
]

export function typeLabel(code) {
  const t = LISTING_TYPES.find(x => x.code === code)
  return t ? t.label : 'Producto'
}

// Emoji de respaldo cuando un aviso no tiene fotos
export function listingEmoji(type) {
  return type === 'servicio' ? '🧰' : '📦'
}

// ---------------------------------------------------------------------------
// Categorías de PRODUCTOS (inspiradas en la taxonomía de yapo.cl)
// ---------------------------------------------------------------------------
export const PRODUCT_CATEGORIES = [
  {
    code: 'vehiculos', label: 'Vehículos', icon: '🚗',
    subcategories: ['Autos', 'Camionetas y 4x4', 'Motos', 'Camiones y furgones', 'Buses', 'Náutica y aviación', 'Accesorios y repuestos', 'Otros vehículos'],
  },
  {
    code: 'inmuebles', label: 'Inmuebles', icon: '🏠',
    subcategories: ['Arriendo departamentos', 'Arriendo casas', 'Venta departamentos', 'Venta casas', 'Oficinas y locales', 'Terrenos y parcelas', 'Bodegas', 'Estacionamientos', 'Arriendo de temporada', 'Pieza y hospedaje'],
  },
  {
    code: 'hogar', label: 'Hogar y muebles', icon: '🛋️',
    subcategories: ['Muebles', 'Decoración e iluminación', 'Menaje y cocina', 'Camas y dormitorio', 'Terraza y quincho', 'Otros hogar'],
  },
  {
    code: 'electrodomesticos', label: 'Electrodomésticos', icon: '🧺',
    subcategories: ['Refrigeradores', 'Lavadoras y secadoras', 'Cocinas y hornos', 'Climatización y calefacción', 'Pequeños electrodomésticos', 'Otros electrodomésticos'],
  },
  {
    code: 'computacion', label: 'Computación', icon: '💻',
    subcategories: ['Notebooks', 'PC de escritorio', 'Tablets', 'Componentes y piezas', 'Impresoras y tinta', 'Accesorios de computación', 'Otros computación'],
  },
  {
    code: 'celulares', label: 'Celulares y telefonía', icon: '📱',
    subcategories: ['Celulares y smartphones', 'Accesorios de celulares', 'Smartwatch y wearables', 'Repuestos de celulares'],
  },
  {
    code: 'audio-video', label: 'TV, audio y fotografía', icon: '📺',
    subcategories: ['Televisores', 'Audio y parlantes', 'Cámaras y drones', 'Proyectores', 'Otros audio y video'],
  },
  {
    code: 'videojuegos', label: 'Consolas y videojuegos', icon: '🎮',
    subcategories: ['Consolas', 'Videojuegos', 'Accesorios gamer', 'PC gamer'],
  },
  {
    code: 'moda', label: 'Moda y vestuario', icon: '👕',
    subcategories: ['Ropa de mujer', 'Ropa de hombre', 'Calzado', 'Carteras y bolsos', 'Relojes y joyas', 'Ropa de niños', 'Otros moda'],
  },
  {
    code: 'salud-belleza', label: 'Salud y belleza', icon: '💄',
    subcategories: ['Perfumes', 'Maquillaje y cosmética', 'Cuidado personal', 'Equipamiento de belleza', 'Otros salud y belleza'],
  },
  {
    code: 'deportes', label: 'Deportes y outdoor', icon: '⚽',
    subcategories: ['Bicicletas', 'Fitness y gimnasio', 'Camping y outdoor', 'Fútbol y deportes de equipo', 'Deportes acuáticos', 'Otros deportes'],
  },
  {
    code: 'hobbies', label: 'Hobbies, libros y música', icon: '🎸',
    subcategories: ['Libros y revistas', 'Instrumentos musicales', 'Coleccionables', 'Arte y antigüedades', 'Películas y series', 'Otros hobbies'],
  },
  {
    code: 'ninos', label: 'Bebés y niños', icon: '🧸',
    subcategories: ['Juguetes', 'Coches y sillas de auto', 'Muebles infantiles', 'Ropa de bebé', 'Otros bebés y niños'],
  },
  {
    code: 'mascotas', label: 'Mascotas', icon: '🐾',
    subcategories: ['Perros', 'Gatos', 'Otras mascotas', 'Accesorios para mascotas', 'Alimento para mascotas'],
  },
  {
    code: 'jardin-herramientas', label: 'Jardín y herramientas', icon: '🛠️',
    subcategories: ['Herramientas eléctricas', 'Herramientas manuales', 'Jardinería', 'Materiales de construcción', 'Maquinaria pesada', 'Otros jardín y herramientas'],
  },
  {
    code: 'negocios', label: 'Negocios e industria', icon: '🏭',
    subcategories: ['Equipamiento comercial', 'Insumos y materiales', 'Venta de negocios', 'Maquinaria industrial', 'Otros negocios'],
  },
  {
    code: 'otros-productos', label: 'Otros productos', icon: '📦',
    subcategories: ['Otros'],
  },
]

// ---------------------------------------------------------------------------
// Categorías de SERVICIOS (vertical donde yapo.cl es líder)
// ---------------------------------------------------------------------------
export const SERVICE_CATEGORIES = [
  {
    code: 'reparaciones-oficios', label: 'Reparaciones y oficios', icon: '🔧',
    subcategories: ['Gasfitería', 'Electricidad', 'Carpintería y muebles', 'Pintura', 'Construcción y obras', 'Techumbre e impermeabilización', 'Cerrajería', 'Técnico en electrodomésticos', 'Soldadura y estructuras', 'Otros oficios'],
  },
  {
    code: 'clases', label: 'Clases y cursos', icon: '📚',
    subcategories: ['Matemáticas y ciencias', 'Idiomas', 'Música', 'Deportes', 'Apoyo escolar', 'Preparación PAES', 'Computación y tecnología', 'Otras clases'],
  },
  {
    code: 'belleza-bienestar', label: 'Belleza y bienestar', icon: '💇',
    subcategories: ['Peluquería y barbería', 'Manicure y pedicure', 'Masajes y terapias', 'Kinesiología', 'Depilación y estética', 'Maquillaje profesional', 'Otros belleza'],
  },
  {
    code: 'eventos', label: 'Eventos y fiestas', icon: '🎉',
    subcategories: ['Fotografía y video', 'Banquetería y catering', 'Animación y shows', 'DJ y música en vivo', 'Arriendo de equipos', 'Decoración de eventos', 'Garzones y personal', 'Otros eventos'],
  },
  {
    code: 'transporte-mudanzas', label: 'Transporte y mudanzas', icon: '🚚',
    subcategories: ['Mudanzas', 'Fletes', 'Transporte de pasajeros', 'Delivery y trámites', 'Otros transporte'],
  },
  {
    code: 'diseno-multimedia', label: 'Diseño y multimedia', icon: '🎨',
    subcategories: ['Diseño gráfico y logos', 'Páginas web', 'Fotografía profesional', 'Producción audiovisual', 'Marketing digital', 'Otros diseño'],
  },
  {
    code: 'informatica', label: 'Informática y tecnología', icon: '🖥️',
    subcategories: ['Reparación de computadores', 'Reparación de celulares', 'Desarrollo de software', 'Soporte y redes', 'Otros informática'],
  },
  {
    code: 'asesorias', label: 'Asesorías profesionales', icon: '⚖️',
    subcategories: ['Legales', 'Contables y tributarias', 'Laborales y RR.HH.', 'Financieras', 'Inmobiliarias', 'Otras asesorías'],
  },
  {
    code: 'servicios-mascotas', label: 'Servicios para mascotas', icon: '🐕',
    subcategories: ['Paseo de perros', 'Peluquería canina', 'Adiestramiento', 'Cuidado y hospedaje', 'Veterinaria a domicilio', 'Otros servicios mascotas'],
  },
  {
    code: 'limpieza', label: 'Limpieza y aseo', icon: '🧹',
    subcategories: ['Aseo doméstico', 'Aseo industrial y oficinas', 'Lavado de alfombras y tapices', 'Sanitización y control de plagas', 'Otros limpieza'],
  },
  {
    code: 'cuidado-personas', label: 'Cuidado de personas', icon: '🤝',
    subcategories: ['Cuidado de niños', 'Cuidado de adultos mayores', 'Enfermería a domicilio', 'Otros cuidados'],
  },
  {
    code: 'automotriz', label: 'Servicios automotrices', icon: '🔩',
    subcategories: ['Mecánica', 'Desabolladura y pintura', 'Lavado y detailing', 'Vulcanización y neumáticos', 'Electricidad automotriz', 'Otros automotriz'],
  },
  {
    code: 'jardineria-servicios', label: 'Jardinería y paisajismo', icon: '🌿',
    subcategories: ['Mantención de jardines', 'Paisajismo', 'Poda y tala', 'Riego automático', 'Otros jardinería'],
  },
  {
    code: 'otros-servicios', label: 'Otros servicios', icon: '🧰',
    subcategories: ['Otros'],
  },
]

export function categoriesForType(type) {
  return type === 'servicio' ? SERVICE_CATEGORIES : PRODUCT_CATEGORIES
}

export function findCategory(type, code) {
  return categoriesForType(type).find(c => c.code === code) || null
}

export function categoryLabel(type, code) {
  const c = findCategory(type, code)
  return c ? c.label : code
}

// ---------------------------------------------------------------------------
// Regiones y comunas de Chile (división político-administrativa completa)
// ---------------------------------------------------------------------------
export const REGIONS = [
  {
    code: 'XV', label: 'Arica y Parinacota',
    comunas: ['Arica', 'Camarones', 'Putre', 'General Lagos'],
  },
  {
    code: 'I', label: 'Tarapacá',
    comunas: ['Iquique', 'Alto Hospicio', 'Pozo Almonte', 'Camiña', 'Colchane', 'Huara', 'Pica'],
  },
  {
    code: 'II', label: 'Antofagasta',
    comunas: ['Antofagasta', 'Calama', 'Mejillones', 'Sierra Gorda', 'Taltal', 'Ollagüe', 'San Pedro de Atacama', 'Tocopilla', 'María Elena'],
  },
  {
    code: 'III', label: 'Atacama',
    comunas: ['Copiapó', 'Caldera', 'Tierra Amarilla', 'Chañaral', 'Diego de Almagro', 'Vallenar', 'Alto del Carmen', 'Freirina', 'Huasco'],
  },
  {
    code: 'IV', label: 'Coquimbo',
    comunas: ['La Serena', 'Coquimbo', 'Ovalle', 'Andacollo', 'La Higuera', 'Paihuano', 'Vicuña', 'Illapel', 'Canela', 'Los Vilos', 'Salamanca', 'Combarbalá', 'Monte Patria', 'Punitaqui', 'Río Hurtado'],
  },
  {
    code: 'V', label: 'Valparaíso',
    comunas: ['Valparaíso', 'Viña del Mar', 'Concón', 'Quilpué', 'Villa Alemana', 'Casablanca', 'Juan Fernández', 'Puchuncaví', 'Quintero', 'Isla de Pascua', 'Los Andes', 'Calle Larga', 'Rinconada', 'San Esteban', 'La Ligua', 'Cabildo', 'Papudo', 'Petorca', 'Zapallar', 'Quillota', 'La Calera', 'Hijuelas', 'La Cruz', 'Nogales', 'San Antonio', 'Algarrobo', 'Cartagena', 'El Quisco', 'El Tabo', 'Santo Domingo', 'San Felipe', 'Catemu', 'Llaillay', 'Panquehue', 'Putaendo', 'Santa María', 'Limache', 'Olmué'],
  },
  {
    code: 'RM', label: 'Región Metropolitana',
    comunas: ['Santiago', 'Cerrillos', 'Cerro Navia', 'Conchalí', 'El Bosque', 'Estación Central', 'Huechuraba', 'Independencia', 'La Cisterna', 'La Florida', 'La Granja', 'La Pintana', 'La Reina', 'Las Condes', 'Lo Barnechea', 'Lo Espejo', 'Lo Prado', 'Macul', 'Maipú', 'Ñuñoa', 'Pedro Aguirre Cerda', 'Peñalolén', 'Providencia', 'Pudahuel', 'Quilicura', 'Quinta Normal', 'Recoleta', 'Renca', 'San Joaquín', 'San Miguel', 'San Ramón', 'Vitacura', 'Puente Alto', 'Pirque', 'San José de Maipo', 'Colina', 'Lampa', 'Tiltil', 'San Bernardo', 'Buin', 'Calera de Tango', 'Paine', 'Melipilla', 'Alhué', 'Curacaví', 'María Pinto', 'San Pedro', 'Talagante', 'El Monte', 'Isla de Maipo', 'Padre Hurtado', 'Peñaflor'],
  },
  {
    code: 'VI', label: "O'Higgins",
    comunas: ['Rancagua', 'Machalí', 'Graneros', 'Codegua', 'Coinco', 'Coltauco', 'Doñihue', 'Las Cabras', 'Malloa', 'Mostazal', 'Olivar', 'Peumo', 'Pichidegua', 'Quinta de Tilcoco', 'Rengo', 'Requínoa', 'San Vicente', 'Pichilemu', 'La Estrella', 'Litueche', 'Marchihue', 'Navidad', 'Paredones', 'San Fernando', 'Chépica', 'Chimbarongo', 'Lolol', 'Nancagua', 'Palmilla', 'Peralillo', 'Placilla', 'Pumanque', 'Santa Cruz'],
  },
  {
    code: 'VII', label: 'Maule',
    comunas: ['Talca', 'Curicó', 'Linares', 'Constitución', 'Curepto', 'Empedrado', 'Maule', 'Pelarco', 'Pencahue', 'Río Claro', 'San Clemente', 'San Rafael', 'Cauquenes', 'Chanco', 'Pelluhue', 'Hualañé', 'Licantén', 'Molina', 'Rauco', 'Romeral', 'Sagrada Familia', 'Teno', 'Vichuquén', 'Colbún', 'Longaví', 'Parral', 'Retiro', 'San Javier', 'Villa Alegre', 'Yerbas Buenas'],
  },
  {
    code: 'XVI', label: 'Ñuble',
    comunas: ['Chillán', 'Chillán Viejo', 'San Carlos', 'Bulnes', 'El Carmen', 'Pemuco', 'Pinto', 'Quillón', 'San Ignacio', 'Yungay', 'Quirihue', 'Cobquecura', 'Coelemu', 'Ninhue', 'Portezuelo', 'Ránquil', 'Treguaco', 'Coihueco', 'Ñiquén', 'San Fabián', 'San Nicolás'],
  },
  {
    code: 'VIII', label: 'Biobío',
    comunas: ['Concepción', 'Talcahuano', 'Hualpén', 'San Pedro de la Paz', 'Chiguayante', 'Coronel', 'Lota', 'Penco', 'Tomé', 'Florida', 'Hualqui', 'Santa Juana', 'Lebu', 'Arauco', 'Cañete', 'Contulmo', 'Curanilahue', 'Los Álamos', 'Tirúa', 'Los Ángeles', 'Antuco', 'Cabrero', 'Laja', 'Mulchén', 'Nacimiento', 'Negrete', 'Quilaco', 'Quilleco', 'San Rosendo', 'Santa Bárbara', 'Tucapel', 'Yumbel', 'Alto Biobío'],
  },
  {
    code: 'IX', label: 'La Araucanía',
    comunas: ['Temuco', 'Padre Las Casas', 'Villarrica', 'Pucón', 'Angol', 'Carahue', 'Cunco', 'Curarrehue', 'Freire', 'Galvarino', 'Gorbea', 'Lautaro', 'Loncoche', 'Melipeuco', 'Nueva Imperial', 'Perquenco', 'Pitrufquén', 'Saavedra', 'Teodoro Schmidt', 'Toltén', 'Vilcún', 'Cholchol', 'Collipulli', 'Curacautín', 'Ercilla', 'Lonquimay', 'Los Sauces', 'Lumaco', 'Purén', 'Renaico', 'Traiguén', 'Victoria'],
  },
  {
    code: 'XIV', label: 'Los Ríos',
    comunas: ['Valdivia', 'Corral', 'Lanco', 'Los Lagos', 'Máfil', 'Mariquina', 'Paillaco', 'Panguipulli', 'La Unión', 'Futrono', 'Lago Ranco', 'Río Bueno'],
  },
  {
    code: 'X', label: 'Los Lagos',
    comunas: ['Puerto Montt', 'Puerto Varas', 'Osorno', 'Castro', 'Ancud', 'Calbuco', 'Cochamó', 'Fresia', 'Frutillar', 'Los Muermos', 'Llanquihue', 'Maullín', 'Chonchi', 'Curaco de Vélez', 'Dalcahue', 'Puqueldón', 'Queilén', 'Quellón', 'Quemchi', 'Quinchao', 'Puerto Octay', 'Purranque', 'Puyehue', 'Río Negro', 'San Juan de la Costa', 'San Pablo', 'Chaitén', 'Futaleufú', 'Hualaihué', 'Palena'],
  },
  {
    code: 'XI', label: 'Aysén',
    comunas: ['Coyhaique', 'Puerto Aysén', 'Lago Verde', 'Cisnes', 'Guaitecas', 'Cochrane', "O'Higgins", 'Tortel', 'Chile Chico', 'Río Ibáñez'],
  },
  {
    code: 'XII', label: 'Magallanes y Antártica',
    comunas: ['Punta Arenas', 'Puerto Natales', 'Laguna Blanca', 'Río Verde', 'San Gregorio', 'Cabo de Hornos', 'Antártica', 'Porvenir', 'Primavera', 'Timaukel', 'Torres del Paine'],
  },
]

export function findRegion(code) {
  return REGIONS.find(r => r.code === code) || null
}

export function regionLabel(code) {
  const r = findRegion(code)
  return r ? r.label : code
}

// ---------------------------------------------------------------------------
// Atributos del aviso
// ---------------------------------------------------------------------------
export const CONDITIONS = [
  { code: 'nuevo', label: 'Nuevo' },
  { code: 'usado', label: 'Usado' },
]

export function conditionLabel(code) {
  const c = CONDITIONS.find(x => x.code === code)
  return c ? c.label : ''
}

// Tipos de precio según tipo de aviso.
export const PRICE_TYPES_PRODUCT = [
  { code: 'fijo', label: 'Precio fijo' },
  { code: 'negociable', label: 'Precio conversable' },
]

export const PRICE_TYPES_SERVICE = [
  { code: 'por_hora', label: 'Por hora' },
  { code: 'por_trabajo', label: 'Por trabajo' },
  { code: 'convenir', label: 'A convenir' },
]

export function priceTypesForType(type) {
  return type === 'servicio' ? PRICE_TYPES_SERVICE : PRICE_TYPES_PRODUCT
}

export function priceTypeLabel(code) {
  const all = [...PRICE_TYPES_PRODUCT, ...PRICE_TYPES_SERVICE]
  const p = all.find(x => x.code === code)
  return p ? p.label : ''
}

export const SHIPPING_OPTIONS = [
  { code: 'retiro', label: 'Solo retiro en persona' },
  { code: 'envio', label: 'Solo envío' },
  { code: 'ambos', label: 'Envío o retiro' },
]

export function shippingLabel(code) {
  const s = SHIPPING_OPTIONS.find(x => x.code === code)
  return s ? s.label : ''
}

export const SORT_OPTIONS = [
  { code: 'recent', label: 'Más recientes' },
  { code: 'price_asc', label: 'Menor precio' },
  { code: 'price_desc', label: 'Mayor precio' },
]

export const LISTING_STATUSES = [
  { code: 'active', label: 'Activo' },
  { code: 'paused', label: 'Pausado' },
  { code: 'sold', label: 'Vendido / Cerrado' },
]

export function statusLabel(code) {
  const s = LISTING_STATUSES.find(x => x.code === code)
  return s ? s.label : code
}

export const MAX_IMAGES = 6

// Moneda del aviso (UF se usa sobre todo en inmuebles, como en yapo.cl)
export const CURRENCIES = [
  { code: 'CLP', label: 'Pesos (CLP)' },
  { code: 'UF', label: 'UF' },
]

// Etiquetas destacadas sobre la foto del aviso (inspiradas en las "Etiquetas" de yapo.cl)
export const BADGES = [
  { code: 'nuevo', label: 'Nuevo' },
  { code: 'poco_uso', label: 'Poco uso' },
  { code: 'oportunidad', label: 'Oportunidad' },
  { code: 'urgente', label: 'Urgente' },
]

export function badgeLabel(code) {
  const b = BADGES.find(x => x.code === code)
  return b ? b.label : ''
}

export const REPORT_REASONS = [
  'Es una estafa o fraude',
  'Producto o servicio prohibido',
  'Información falsa o engañosa',
  'Aviso duplicado o spam',
  'Categoría incorrecta',
  'Contenido ofensivo',
  'Otro motivo',
]
