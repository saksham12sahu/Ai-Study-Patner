import os
import logging
from flask import Flask
from flask_login import LoginManager
from flask_session import Session
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from werkzeug.security import generate_password_hash
from extensions import db, login_manager
from dotenv import load_dotenv


# Configure logging
logging.basicConfig(level=logging.DEBUG)


login_manager.login_view = 'login'
login_manager.login_message = 'Please log in to access this page.'
login_manager.login_message_category = 'info'

# Create Flask app
app = Flask(__name__)
app.secret_key = '1234'

# Configure session to use filesystem
app.config["SESSION_TYPE"] = "filesystem"
app.config["SESSION_PERMANENT"] = False
Session(app)

# Configure the database

# MySQL database URI
app.config['SQLALCHEMY_DATABASE_URI'] = f"mysql+pymysql://{os.getenv('DB_USERNAME')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}" # 'mysql+pymysql://ursername:password@localhost/database_name'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize extensions with the app
db.init_app(app)
login_manager.init_app(app)

# User loader function for Flask-Login
@login_manager.user_loader
def load_user(user_id):
    from models import User
    return User.query.get(int(user_id))

# Create the database tables
with app.app_context():
    # Import models to ensure they're registered with SQLAlchemy
    import models  # noqa
    
    db.create_all()
    
    # Create a default admin user if none exists
    from models import User
    if User.query.filter_by(username='admin').first() is None:
        admin_user = User(
            username='admin',
            email='admin@example.com',
            password_hash=generate_password_hash('admin123')
        )
        db.session.add(admin_user)
        db.session.commit()
        logging.info("Created default admin user")

# Import routes after app initialization to avoid circular imports
from routes import *
