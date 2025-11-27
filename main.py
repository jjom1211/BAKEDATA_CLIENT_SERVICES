from flask import Flask, render_template, send_from_directory, jsonify, request, session, redirect
import pymysql
import pytz
from datetime import datetime
from functools import wraps
import os
from werkzeug.security import generate_password_hash
from werkzeug.security import check_password_hash

app = Flask(__name__, template_folder='HTML')
app.secret_key = "super_secret_key_bakedata_123"  # puede ser cualquier cadena
app.config['SESSION_COOKIE_NAME'] = 'session_usuario_grace'
db_config = {
    'host': 'localhost',
    'user': 'root',
    'password': 'bakedata',
    'db': 'mydb'
}

# ========== DECORADORES ==========

def login_required(f):
    """Decorador para verificar que el usuario esté logueado"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'usu_id' not in session:
            return jsonify({'error': 'Se requiere autenticación'}), 401
        return f(*args, **kwargs)
    return decorated_function

# ========== RUTAS PRINCIPALES ==========

@app.route('/')
def inicio():
    return render_template('usu_bakedata.html')

@app.route('/conocenos')
def conocenos():
    return render_template('usu_conocenos.html')

@app.route('/sucursales')
def sucursales():
    return render_template('usu_sucursales.html')

@app.route('/api/sucursales')
def obtener_sucursales():
    """Obtiene todas las sucursales disponibles"""
    conn = pymysql.connect(**db_config)
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            sql = ("""
                SELECT suc_id, suc_nombre, suc_direccion, suc_telefono 
                FROM sucursales
                ORDER BY suc_nombre
            """)
            cursor.execute(sql)
            
            sucursales = cursor.fetchall()
            return jsonify(sucursales), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# --- RUTA PARA VER LA PÁGINA ---
@app.route('/pedidos_usuario')
@login_required
def mis_pedidos_pagina():
    return render_template('usu_mis_pedidos.html')


@app.route('/error')
def error():
    return render_template('usu_excepciones.html')

# ========== RUTAS DEL CARRITO ==========

@app.route('/realizar_pedido')
def realizar_pedido():
    return render_template('usu_realizar_pedido.html')

@app.route('/carrito')
def carrito():
    """Renderiza la página del carrito si el usuario está logueado"""
    if 'usu_id' not in session:
        print(session)
        return redirect('/login')
    else: 
        return render_template('usu_carrito.html')

# ========== APIs DEL CARRITO (SINCRONIZACIÓN CON BD) ==========

@app.route('/api/carrito/sincronizar', methods=['POST'])
@login_required
def sincronizar_carrito():
    conn = pymysql.connect(**db_config)
    try:
        usuario_id = session.get('usu_id')
        carrito_local = request.get_json()
        
        if not isinstance(carrito_local, list):
            return jsonify({'error': 'Formato inválido'}), 400
        
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            # Estrategia: "Upsert" (Actualizar si existe, Insertar si no)
            # No borramos todo primero para no perder lo que ya tenía en BD si se loguea en otro lado
            
            for item in carrito_local:
                # 1. Verificar si ya existe en BD
                sql_check = "SELECT id, cantidad FROM usu_carrito WHERE usuario_id = %s AND producto_id = %s"
                cursor.execute(sql_check, (usuario_id, item['id']))
                existente = cursor.fetchone()
                
                if existente:
                    # Si existe, sumamos la cantidad local a la de BD (o la reemplazamos, según prefieras)
                    # Aquí elegimos reemplazar para priorizar la sesión actual
                    sql_update = "UPDATE usu_carrito SET cantidad = %s, actualizado_en = NOW() WHERE id = %s"
                    cursor.execute(sql_update, (item['cantidad'], existente['id']))
                else:
                    # Si no existe, insertamos
                    sql_insert = """
                        INSERT INTO usu_carrito (usuario_id, producto_id, cantidad, categoria, agregado_en)
                        VALUES (%s, %s, %s, %s, NOW())
                    """
                    cursor.execute(sql_insert, (usuario_id, item['id'], item['cantidad'], item.get('categoria', 'general')))
        
        conn.commit()
        return jsonify({'success': True}), 200
        
    except Exception as e:
        conn.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/carrito/obtener')
@login_required
def obtener_carrito_bd():
    """
    Obtiene el carrito persistido del usuario desde la base de datos.
    Retorna los productos en formato compatible con localStorage.
    """
    conn = pymysql.connect(**db_config)
    try:
        usuario_id = session.get('usu_id')
        
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            sql = """
                SELECT 
                    p.pro_id as id, 
                    p.pro_nombre as nombre, 
                    p.pro_precio as precio,
                    c.categoria, 
                    c.cantidad 
                FROM usu_carrito c
                JOIN productos p ON c.producto_id = p.pro_id
                WHERE c.usuario_id = %s
                ORDER BY c.agregado_en DESC
            """
            cursor.execute(sql, (usuario_id,))
            
            carrito_persistido = cursor.fetchall()
            
            # Convertir a formato compatible con localStorage
            carrito_formateado = []
            for item in carrito_persistido:
                carrito_formateado.append({
                    'id': item['id'],
                    'nombre': item['nombre'],
                    'precio': float(item['precio']),
                    'categoria': item['categoria'],
                    'cantidad': item['cantidad'],
                    'imagen': f"/static/img/productos/{item['categoria']}/{item['id']}.jpg" # Generamos la ruta aqui
                })
            
            return jsonify(carrito_formateado), 200
        
    except Exception as e:
        print(f"error: " ,str(e))
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/carrito/agregar', methods=['POST'])
@login_required
def agregar_producto_carrito():
    conn = pymysql.connect(**db_config)
    try:
        usuario_id = session.get('usu_id')
        datos = request.get_json()
        producto_id = datos.get('producto_id')
        cantidad = datos.get('cantidad', 1)
        categoria = datos.get('categoria', 'general')
        
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            # Verificar existencia
            sql_check = "SELECT id FROM usu_carrito WHERE usuario_id = %s AND producto_id = %s"
            cursor.execute(sql_check, (usuario_id, producto_id))
            existente = cursor.fetchone()
            
            if existente:
                # CORREGIDO: Nombre de tabla 'usu_carrito' (antes decía 'carrito')
                sql_update = "UPDATE usu_carrito SET cantidad = cantidad + %s, actualizado_en = NOW() WHERE id = %s"
                cursor.execute(sql_update, (cantidad, existente['id']))
            else:
                sql_insert = """
                    INSERT INTO usu_carrito (usuario_id, producto_id, cantidad, categoria, agregado_en)
                    VALUES (%s, %s, %s, %s, NOW())
                """
                cursor.execute(sql_insert, (usuario_id, producto_id, cantidad, categoria))
        
        conn.commit()
        return jsonify({'success': True}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close

@app.route('/api/carrito/eliminar/<int:producto_id>', methods=['DELETE'])
@login_required
def eliminar_producto_carrito(producto_id):
    """
    Elimina un producto específico del carrito del usuario en la BD.
    """
    conn = pymysql.connect(**db_config)
    try:
        usuario_id = session.get('usu_id')
        
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            sql = """
                DELETE FROM usu_carrito 
                WHERE usuario_id = %s AND producto_id = %s
            """
            cursor.execute(sql, (usuario_id, producto_id))
            
            conn.commit()
            
            if cursor.rowcount > 0:
                return jsonify({'success': True, 'message': 'Producto eliminado del carrito'}), 200
            else:
                return jsonify({'error': 'Producto no encontrado en el carrito'}), 404
        
    except Exception as e:
        conn.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/carrito/actualizar', methods=['PUT'])
@login_required
def actualizar_cantidad_carrito():
    """
    Actualiza la cantidad de un producto en el carrito.
    Si la cantidad es 0 o menor, elimina el producto.
    """
    conn = pymysql.connect(**db_config)
    try:
        usuario_id = session.get('usu_id')
        datos = request.get_json()
        
        producto_id = datos.get('producto_id')
        cantidad = datos.get('cantidad')
        
        if not producto_id or cantidad is None:
            return jsonify({'error': 'ID de producto y cantidad requeridos'}), 400
        
        if cantidad <= 0:
            # Si la cantidad es 0 o menor, eliminar el producto
            return eliminar_producto_carrito(producto_id)
        
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            sql = """
                UPDATE usu_carrito 
                SET cantidad = %s, actualizado_en = %s
                WHERE usuario_id = %s AND producto_id = %s
            """
            cursor.execute(sql, (cantidad, datetime.now(), usuario_id, producto_id))
            
            conn.commit()
            
            if cursor.rowcount > 0:
                return jsonify({'success': True, 'message': 'Cantidad actualizada'}), 200
            else:
                return jsonify({'error': 'Producto no encontrado en el carrito'}), 404
        
    except Exception as e:
        conn.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/carrito/vaciar', methods=['DELETE'])
@login_required
def vaciar_carrito():
    """
    Vacía completamente el carrito del usuario en la base de datos.
    """
    conn = pymysql.connect(**db_config)
    try:
        usuario_id = session.get('usu_id')
        
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            sql = "DELETE FROM usu_carrito WHERE usuario_id = %s"
            cursor.execute(sql, (usuario_id,))
            
            conn.commit()
            return jsonify({'success': True, 'message': 'Carrito vaciado'}), 200
        
    except Exception as e:
        conn.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()

# ========== APIs DE PEDIDOS ==========

@app.route('/api/pedidos/crear', methods=['POST'])
@login_required
def crear_pedido():
    """
    Crea un nuevo pedido con fecha y hora de entrega.
    """
    conn = pymysql.connect(**db_config)
    try:
        usuario_id = session.get('usu_id')
        datos = request.get_json()
        
        if not datos or 'productos' not in datos:
            return jsonify({'success': False, 'error': 'Datos inválidos'}), 400
        
        # Validar que vengan las fechas (opcional pero recomendado)
        if not datos.get('fecha_entrega') or not datos.get('hora_entrega'):
            return jsonify({'success': False, 'error': 'Fecha y hora de entrega requeridas'}), 400

        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            # Calcular monto total
            monto_total = 0.0
            for producto in datos['productos']:
                monto_total += float(producto['precio']) * int(producto['cantidad'])
            
            # 1. Insertar en la tabla pedidos (CON NUEVAS COLUMNAS)
            sql_pedido = """
                INSERT INTO pedidos (
                    ped_usu_id, 
                    ped_sucursal_origen, 
                    ped_sucursal_destino, 
                    ped_fecha_pedido,      -- Fecha de CREACIÓN (Hoy)
                    ped_fecha_entrega,     -- Fecha de RECOGIDA (Futuro)
                    ped_hora_entrega,      -- Hora de RECOGIDA
                    ped_monto_total, 
                    ped_estado_pedido, 
                    ped_asunto, 
                    ped_comentarios
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            
            cursor.execute(sql_pedido, (
                usuario_id,
                datos['sucursal_id'],
                datos['sucursal_id'],
                datetime.now().date(),      # ped_fecha_pedido (Automático hoy)
                datos['fecha_entrega'],     # ped_fecha_entrega (Viene del modal)
                datos['hora_entrega'],      # ped_hora_entrega (Viene del modal)
                monto_total,
                'P',                        # Pendiente
                datos.get('asunto', 'Pedido desde carrito'),
                datos.get('comentarios', '')
            ))
            
            pedido_id = cursor.lastrowid
            
            # 2. Insertar en DETALLE_PEDIDO_PRODUCTOS (Esto no cambia)
            sql_detalle = """
                INSERT INTO detalle_pedido_productos (
                    detpedpro_ped_id, 
                    detpedpro_pro_id, 
                    detpedpro_cantidad, 
                    detpedpro_precio_unitario 
                ) VALUES (%s, %s, %s, %s)
            """
            
            for producto in datos['productos']:
                cursor.execute(sql_detalle, (
                    pedido_id,
                    producto['id'],
                    producto['cantidad'],
                    producto['precio']
                ))
            
            # 3. Vaciar carrito
            sql_vaciar_carrito = "DELETE FROM usu_carrito WHERE usuario_id = %s"
            cursor.execute(sql_vaciar_carrito, (usuario_id,))
            
            conn.commit()
            
            return jsonify({
                'success': True, 
                'pedido_id': pedido_id, 
                'message': 'Pedido creado exitosamente'
            }), 200
        
    except Exception as e:
        conn.rollback()
        print(f"Error creando pedido: {str(e)}") 
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/pedidos/<int:pedido_id>')
@login_required
def ver_pedido(pedido_id):
    """
    Renderiza la página de detalles de un pedido específico.
    """
    return render_template('usu_detalle_pedido.html', pedido_id=pedido_id)

@app.route('/api/pedidos/<int:pedido_id>')
@login_required
def obtener_pedido(pedido_id):
    """
    Obtiene los detalles de un pedido específico para el usuario.
    """
    conn = pymysql.connect(**db_config)
    try:
        usuario_id = session.get('usu_id')
        
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            # 1. Obtener información del pedido
            sql_pedido = """
                SELECT p.*, s.suc_nombre, s.suc_direccion
                FROM pedidos p
                JOIN sucursales s ON p.ped_sucursal_origen = s.suc_id
                WHERE p.ped_id = %s AND p.ped_usu_id = %s
            """
            cursor.execute(sql_pedido, (pedido_id, usuario_id))
            
            pedido = cursor.fetchone()
            
            if not pedido:
                return jsonify({'error': 'Pedido no encontrado'}), 404
            

            if 'ped_fecha_pedido' in pedido:
                pedido['ped_fecha_pedido'] = str(pedido['ped_fecha_pedido'])
            
            # Convertir Decimal a float
            pedido['ped_monto_total'] = float(pedido['ped_monto_total'])
            if 'ped_fecha_entrega' in pedido and pedido['ped_fecha_entrega']:
                pedido['ped_fecha_entrega'] = str(pedido['ped_fecha_entrega'])
            if 'ped_hora_entrega' in pedido and pedido['ped_hora_entrega']:
                pedido['ped_hora_entrega'] = str(pedido['ped_hora_entrega'])
            # 2. Obtener productos
            # --- CORRECCIÓN 2: Cambié 'p.pro_descripcion' por 'p.pro_descr' ---
            # (Verifica en tu BD si se llama 'pro_descr' o 'pro_descripcion')
            sql_productos = """
                SELECT 
                    d.detpedpro_id,
                    d.detpedpro_pro_id as producto_id,
                    d.detpedpro_cantidad as cantidad,
                    d.detpedpro_precio_unitario as precio_unitario,
                    d.detpedpro_precio_total_linea as subtotal,
                    p.pro_nombre,
                    p.pro_descr as pro_descripcion, 
                    p.pro_categoria
                FROM detalle_pedido_productos d
                JOIN productos p ON d.detpedpro_pro_id = p.pro_id
                WHERE d.detpedpro_ped_id = %s
            """
            cursor.execute(sql_productos, (pedido_id,))
            
            productos = cursor.fetchall()
            
            # Convertir decimales a float para JSON
            for producto in productos:
                producto['cantidad'] = int(producto['cantidad']) # A veces viene como decimal
                producto['precio_unitario'] = float(producto['precio_unitario'])
                producto['subtotal'] = float(producto['subtotal'])
            
            return jsonify({
                'pedido': pedido,
                'productos': productos
            }), 200
        
    except Exception as e:
        print(f"ERROR API PEDIDO: {str(e)}") # Esto imprimirá el error real en tu consola negra
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# --- API PARA OBTENER LOS DATOS ---
@app.route('/api/pedidos_usuario/obtener')
@login_required
def api_mis_pedidos():
    conn = pymysql.connect(**db_config)
    try:
        usuario_id = session.get('usu_id')
        
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            # Seleccionamos pedidos y el nombre de la sucursal
            sql = """
                SELECT 
                    p.ped_id, 
                    p.ped_fecha_pedido, 
                    p.ped_monto_total, 
                    p.ped_estado_pedido,
                    s.suc_nombre
                FROM pedidos p
                JOIN sucursales s ON p.ped_sucursal_origen = s.suc_id
                WHERE p.ped_usu_id = %s
                ORDER BY p.ped_fecha_pedido DESC, p.ped_id DESC
            """
            cursor.execute(sql, (usuario_id,))
            pedidos = cursor.fetchall()
            
            # Formatear datos para el frontend
            for p in pedidos:
                p['ped_monto_total'] = float(p['ped_monto_total'])
                p['ped_fecha_pedido'] = str(p['ped_fecha_pedido']) # Importante para JSON
                
            return jsonify(pedidos), 200
            
    except Exception as e:
        print(f"Error obteniendo mis pedidos: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# ========== AUTENTICACIÓN ==========

@app.route('/register')
def register():
    return render_template('usu_register.html')

@app.route('/register', methods=['POST'])
def register_post():
    userData = request.json
    
    # Obtener valores con .get para evitar errores si falta alguno
    usu_nombre     = userData.get('nombre') 
    usu_apellido   = userData.get('apellido') 
    usu_correo     = userData.get('correo') 
    usu_telefono   = userData.get('telefono') 
    usu_password   = userData.get('password') 

    conn = pymysql.connect(**db_config)
    hashed_password = generate_password_hash(usu_password)
    
    try: 
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            # 1. Validación de CORREO duplicado
            cursor.execute("SELECT usu_correo FROM usuarios WHERE usu_correo = %s", (usu_correo,))
            if cursor.fetchone():
                # Código 409 = Conflicto (ya existe)
                return jsonify({'success': False, 'message': "El correo electrónico ya está registrado."}), 409
            
            # 2. Validación de TELÉFONO duplicado
            cursor.execute("SELECT usu_telefono FROM usuarios WHERE usu_telefono = %s", (usu_telefono,))
            if cursor.fetchone():
                # Código 409 = Conflicto
                return jsonify({'success': False, 'message': "El número de teléfono ya está registrado."}), 409

            # 3. Obtener ID de secuencia (tu lógica actual)
            cursor.execute("INSERT INTO user_sequence (valor) VALUES (1)")
            cursor.execute("SELECT LAST_INSERT_ID() as new_id")
            nuevo_id = cursor.fetchone()['new_id']

            # 4. Inserción del nuevo usuario
            sql = """
                INSERT INTO usuarios (usu_id, usu_nombre, usu_apellido, usu_correo, usu_contrasenia, usu_telefono) 
                VALUES (%s, %s, %s, %s, %s, %s)
            """
            cursor.execute(sql, (nuevo_id, usu_nombre, usu_apellido, usu_correo, hashed_password, usu_telefono))
            
        conn.commit()
        
        # Código 201 = Creado exitosamente
        return jsonify({'success': True, 'message': f"¡Cliente '{usu_nombre} {usu_apellido}' registrado exitosamente!"}), 201

    except Exception as e:
        conn.rollback() # Importante hacer rollback si falla
        print(f"Error en BD al crear cliente: {e}")
        # Código 500 = Error interno del servidor
        return jsonify({'success': False, 'message': "Ocurrió un error interno con la base de datos."}), 500
        
    finally:
        if conn:
            conn.close()

@app.route('/login')
def login():
    return render_template('usu_login.html')

@app.route('/login', methods=['POST'])
def handle_login():

    data = request.json
    correo = data.get('username')
    password = data.get('password')
    conn = pymysql.connect(**db_config)

    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            # verificamos el correo
            sql = """
                SELECT usu_id, usu_nombre,
                    usu_apellido,
                    usu_contrasenia,
                    usu_correo
                FROM usuarios 
                WHERE usu_correo = %s
            """
            cursor.execute(sql, (correo,))
            usuario = cursor.fetchone()
            if not usuario:
                return jsonify({'error': 'Usuario no encontrado'}), 401
            # 2. Verificamos si el usuario existe Y si la contraseña hasheada coincide
            if not check_password_hash(usuario['usu_contrasenia'], password):
                # Si no existe o la contraseña no coincide, es un error
                return jsonify({'error': 'Contraseña Incorrecta'}), 401
            # Limpiamos cualquier sesión anterior por seguridad
            session.clear()
            # Guardamos los datos del usario en la sesión
            session['usu_id'] = usuario['usu_id']
            session['usu_nombre'] = usuario['usu_nombre']
            session['usu_apellido'] = usuario['usu_apellido'] # Muy útil para tus filtros
            session['usu_correo'] = usuario['usu_correo']
            tz = pytz.timezone('America/Mexico_City')
            hora_actual = datetime.now(tz).hour
            if 5 <= hora_actual < 12:
                saludo = f"¡Buenos días {session['usu_nombre']}!"
            elif 12 <= hora_actual < 19:
                saludo = f"¡Buenas tardes {session['usu_nombre']}!"
            else:
                saludo = f"¡Buenas noches {session['usu_nombre']}!"
                
            return jsonify({
                'message': f"{saludo}, ¡Bienvenido!", # También aquí comillas dobles afuera
            }), 200
    finally:
        conn.close()

@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")

# ========== RUTAS DE CATEGORÍAS ==========

@app.route('/categorias/<categoria>')
def categoria_page(categoria):
    return render_template('categorias/usu_categorias.html')

@app.route('/api/categorias/<categoria>')
def getCategorias(categoria):
    conn = pymysql.connect(**db_config)
    categoria = categoria.lower()
    # Obtener fecha actual
    hoy = datetime.now()
    mes = hoy.month
    dia = hoy.day
    productos_temporada = []
    # RANGO DÍA DE MUERTOS: 
    # Configurado para: Octubre (10) y hasta el 20 de Noviembre (11)
    # Puedes ajustar los números de mes/día según tus necesidades
    if (mes == 10) or (mes == 11 and dia <= 30):
        productos_temporada.append('PAN TEMPORADA MUERTO')
    # RANGO ROSCA DE REYES:
    # Configurado para: Diciembre (12) y Enero (1)
    elif (mes == 12) or (mes == 1):
        productos_temporada.append('PAN TEMPORADA ROSCA REYES')
    
    categoria_map = {
        'panes': [
            'PAN MANTECA', 'PAN POLVORON', 'PAN DANES', 'PAN CONCHA',
            'PAN FEITE', 'PAN OTROS', 'PAN SURTIDO', 'PAN RELLENO',
            'PAN POSTRE', 'PAN BLANCO'
        ],
        'galletas': ['GALLETAS'],
        'gelatinas': ['GELATINAS Y FLANES'],
        'temporada': productos_temporada,
        'pasteles': ['PASTELES'],
        'postres': ['POSTRES'],
        'pizzas': ['PIZZA'],
    }

    if categoria not in categoria_map:
        return jsonify({'error': 'Categoría no válida'}), 404
    # Obtenemos la lista de categorías a buscar
    lista_busqueda = categoria_map[categoria]

    # Si la lista está vacía (ej. es 23 Nov y entran a 'temporada'),
    # regresamos una lista vacía inmediatamente y NO ejecutamos SQL.
    if not lista_busqueda:
        return jsonify([]), 200
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            placeholders = ', '.join(['%s'] * len(lista_busqueda))
            sql = f"""
                SELECT pro_id, pro_nombre,
                    pro_descr, pro_precio, pro_costo_unit
                FROM productos
                WHERE pro_categoria IN ({placeholders})
                AND pro_id NOT IN (1093,6012,6013,6014,10230)
            """
            cursor.execute(sql, tuple(lista_busqueda))
            productos = cursor.fetchall()
            productos_validos = []
            #productos_validos = productos # Temporalmente deshabilitado el filtro de imágenes
            
            # Asumimos que tu carpeta static está en la raíz donde corre el script
            # Si usas una estructura diferente, ajusta la ruta base.
            static_folder = os.path.join(app.root_path, 'static')
            for prod in productos:
                # Construimos la ruta física donde DEBERÍA estar la imagen
                # Ejemplo: static/img/productos/temporada/4001.jpg
                nombre_imagen = f"{prod['pro_id']}.jpg"
                ruta_relativa = os.path.join('img', 'productos', categoria, nombre_imagen)
                ruta_absoluta = os.path.join(static_folder, ruta_relativa)
                # Verificamos si el archivo existe en el disco duro
                if os.path.exists(ruta_absoluta):
                    # Si existe, lo agregamos a la lista que enviaremos
                    productos_validos.append(prod)
                else:
                    # Si no existe, lo ignoramos (esto evita el error 404 en el frontend)
                    print(f"Omitiendo producto {prod['pro_id']} - Imagen no encontrada en: {ruta_absoluta}")
            
            return jsonify(productos_validos), 200
    finally:
        conn.close()

# ========== RUTAS DE ARCHIVOS ESTÁTICOS ==========

@app.route('/CSS/<path:filename>')
def serve_css(filename):
    return send_from_directory('CSS', filename)

@app.route('/JS/<path:filename>')
def serve_js(filename):
    return send_from_directory('JS', filename)

@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory('static', filename)

@app.route('/CSS/categorias/<path:filename>')
def categorias_css(filename):
    return send_from_directory('CSS/categorias', filename)

if __name__ == '__main__':
    #app.run(host 'ip' ,  port = 5555, debug = true)
    app.run(host= '0.0.0.0' ,port=8888,debug=True)
