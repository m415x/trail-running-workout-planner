#!/bin/bash

# Verificar si se proporcionó un directorio
if [ $# -eq 0 ]; then
    DIRECTORIO="."
else
    DIRECTORIO="$1"
fi

# Verificar si el directorio existe
if [ ! -d "$DIRECTORIO" ]; then
    echo "Error: El directorio '$DIRECTORIO' no existe."
    exit 1
fi

# Nombre del archivo de salida
ARCHIVO_SALIDA="mapeo_proyecto.txt"

# Función para generar árbol de directorios
generar_arbol() {
    echo "=== ÁRBOL DE DIRECTORIOS ==="
    echo ""
    find "$DIRECTORIO" -type d | sed -e "s|[^/]*/|- |g" -e "s|-[^/]*/|  |g" -e "s|- |├── |"
    echo ""
}

# Función para listar archivos y su contenido
listar_archivos() {
    echo "=== CONTENIDO DE ARCHIVOS ==="
    echo ""
    
    # Encontrar todos los archivos (excluyendo el archivo de salida y directorios .git)
    find "$DIRECTORIO" -type f ! -name "$ARCHIVO_SALIDA" ! -path "*/\.git/*" | while read -r archivo; do
        # Obtener la ruta relativa
        ruta_relativa="${archivo#$DIRECTORIO/}"
        
        # Mostrar el encabezado del archivo
        echo "/* ============================================================== */"
        echo "/* $ruta_relativa */"
        echo "/* ============================================================== */"
        
        # Mostrar el contenido del archivo
        cat "$archivo"
        
        # Agregar una línea en blanco entre archivos
        echo ""
        echo ""
    done
}

# Ejecutar las funciones y guardar en el archivo
{
    generar_arbol
    listar_archivos
} > "$ARCHIVO_SALIDA"

echo "Mapeo completado. Resultado guardado en: $ARCHIVO_SALIDA"