const express = require('express');
const cors = require('cors');
const { Pool } = require('pg'); // Cambiado a 'pg' en lugar de 'mysql'
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt'); // Añadir bcrypt para el hashing de contraseñas

const app = express();
const port = process.env.PORT || 3000;

// Aplicar CORS
app.use(cors()); // Esto permite todas las solicitudes CORS; personaliza según necesidad

app.use(bodyParser.json());

// Configuración de la conexión a la base de datos
const pool = new Pool({
    max: 10,
    host: 'cd1goc44htrmfn.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com',
    user: 'uqeqr4ocsnpmu',
    password: 'pec0585dfce074cb4fe5bed82c7981d188557d53c6393e36a4ab3b8ff1d7d2be3',
    database: 'd4gq52s9kraobb',
    port: 5432,
    ssl: {
        rejectUnauthorized: false
    },
    // Configura el search_path para utilizar el esquema d4gq52s9kraobb
    statement_timeout: 30000, // Opcional: configurar timeout para las consultas
    application_name: 'MyApp',
    options: '-c search_path=d4gq52s9kraobb' // Aquí se configura el search_path
});


// Endpoint para guardar o actualizar el JSON y el título en la base de datos
app.post('/save/:id', (req, res) => {
    const id = req.params.id;
    const { items, title } = req.body;
    const data = JSON.stringify(items);

    // Verifica si el registro ya existe
    pool.query('SELECT * FROM list_json WHERE id = $1', [id], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error al verificar el registro existente');
        }

        if (results.rows.length > 0) {
            // Si el registro existe, actualiza
            pool.query('UPDATE list_json SET json_column = $1, title = $2 WHERE id = $3', [data, title, id], (error, updateResults) => {
                if (error) {
                    console.error(error);
                    return res.status(500).send('Error al actualizar los datos');
                }
                res.send('Datos actualizados con éxito');
            });
        } else {
            // Si no existe, inserta el nuevo registro
            pool.query('INSERT INTO list_json (id, json_column, title) VALUES ($1, $2, $3)', [id, data, title], (error, insertResults) => {
                if (error) {
                    console.error(error);
                    return res.status(500).send('Error al guardar los datos');
                }
                res.send('Datos guardados con éxito');
            });
        }
    });
});

// Endpoint para cargar el JSON y el título de la base de datos
app.get('/load/:id', (req, res) => {
    const id = req.params.id;
    // Selecciona los datos del registro deseado
    pool.query('SELECT title, json_column, color FROM list_json WHERE id = $1', [id], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).send('Error al obtener los datos');
        }
        if (results.rows.length > 0) {
            res.json({
                items: JSON.parse(results.rows[0].json_column),
                title: results.rows[0].title,
                color: results.rows[0].color,
            }); // Envía los datos como JSON
        } else {
            res.status(404).send('Datos no encontrados');
        }
    });
});

// Endpoint para obtener todas las listas
app.get('/lists/:userId', (req, res) => {
    const userId = req.params.userId;
    pool.query('SELECT id, title, important, color FROM list_json WHERE usuario_list_system_idusuario_list_system = $1', [userId], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).send('Error al obtener las listas');
        }
        res.json(results.rows); // Enviar las listas como JSON
    });
});

// Endpoint para eliminar una lista
app.delete('/delete/:id', (req, res) => {
    const id = req.params.id;
    const { userId } = req.body;

    pool.query('DELETE FROM list_json WHERE id = $1 AND usuario_list_system_idusuario_list_system = $2', [id, userId], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).send('Error al eliminar la lista');
        }
        res.send('Lista eliminada con éxito');
    });
});

// Endpoint para crear una nueva lista y devolver su ID
app.post('/create', (req, res) => {
    const { title, userId } = req.body;
    const data = JSON.stringify([]); // Lista vacía inicialmente

    pool.query('INSERT INTO list_json (json_column, title, usuario_list_system_idusuario_list_system) VALUES ($1, $2, $3) RETURNING id', [data, title, userId], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).send('Error al crear la nueva lista');
        }
        res.json({ id: results.rows[0].id }); // Devolver el ID de la nueva lista
    });
});

// Endpoint para cambiar el estado de favorito de 0 a 1 y viceversa
app.put('/important/:id', (req, res) => {
    const id = req.params.id;
    pool.query('SELECT important FROM list_json WHERE id = $1', [id], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).send('Error al obtener el estado de favorito');
        }
        const important = results.rows[0].important === 1 ? 0 : 1;
        pool.query('UPDATE list_json SET important = $1 WHERE id = $2', [important, id], (error, updateResults) => {
            if (error) {
                console.error(error);
                return res.status(500).send('Error al actualizar el estado de favorito');
            }
            res.send('Estado de favorito actualizado con éxito');
        });
    });
});

// Endpoint para actualizar el color de una lista
app.put('/updateColor/:id', (req, res) => {
    const id = req.params.id;
    const { color } = req.body;

    pool.query('UPDATE list_json SET color = $1 WHERE id = $2', [color, id], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).send('Error al actualizar el color');
        }
        res.send('Color actualizado con éxito');
    });
});

// Endpoint para duplicar una lista
app.post('/duplicate/:id', (req, res) => {
    const id = req.params.id;
    const { userId } = req.body;

    pool.query('SELECT json_column, title, color FROM list_json WHERE id = $1 AND usuario_list_system_idusuario_list_system = $2', [id, userId], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).send('Error al obtener la lista original');
        }

        if (results.rows.length > 0) {
            const originalList = results.rows[0];
            const newTitle = `${originalList.title} (Copia)`;

            pool.query('INSERT INTO list_json (json_column, title, color, usuario_list_system_idusuario_list_system) VALUES ($1, $2, $3, $4) RETURNING id', [originalList.json_column, newTitle, originalList.color, userId], (insertError, insertResults) => {
                if (insertError) {
                    console.error(insertError);
                    return res.status(500).send('Error al duplicar la lista');
                }
                res.json({ id: insertResults.rows[0].id });
            });
        } else {
            res.status(404).send('Lista no encontrada');
        }
    });
});

// Registro de nuevo usuario
app.post('/register', async (req, res) => {
    const { nombres, correo, clave } = req.body;

    try {
        // Verificar si el correo o el nombre ya existen
        pool.query('SELECT * FROM usuario_list_system WHERE correo = $1 OR nombres = $2', [correo, nombres], async (error, results) => {
            if (error) {
                console.error(error);
                return res.status(500).send('Error al verificar el usuario');
            }

            if (results.rows.length > 0) {
                // Si el correo o nombre ya existen, devolver un error
                if (results.rows[0].correo === correo) {
                    return res.status(409).json({ message: 'El correo ya está registrado' });
                }
                if (results.rows[0].nombres === nombres) {
                    return res.status(409).json({ message: 'El nombre ya está registrado' });
                }
            } else {
                // Si no existen, proceder con el registro
                const hashedPassword = await bcrypt.hash(clave, 10);

                pool.query('INSERT INTO usuario_list_system (nombres, correo, clave) VALUES ($1, $2, $3)', 
                    [nombres, correo, hashedPassword], (error, results) => {
                    if (error) {
                        console.error(error);
                        return res.status(500).send('Error al registrar el usuario');
                    }
                    res.send('Usuario registrado con éxito');
                });
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error interno');
    }
});

// Inicio de sesión
app.post('/login', (req, res) => {
    const { correo, clave } = req.body;

    pool.query('SELECT * FROM usuario_list_system WHERE correo = $1', [correo], async (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).send('Error al buscar el usuario');
        }

        if (results.rows.length > 0) {
            const user = results.rows[0];

            // Comparar la clave proporcionada con la clave almacenada
            const isMatch = await bcrypt.compare(clave, user.clave);

            if (isMatch) {
                // Devolver el ID del usuario
                res.json({ idusuario_list_system: user.idusuario_list_system });
            } else {
                res.status(401).send('Correo o clave incorrectos');
            }
        } else {
            res.status(401).send('Correo o clave incorrectos');
        }
    });
});

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
