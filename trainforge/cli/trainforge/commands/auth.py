# File: trainforge/cli/trainforge/commands/auth.py
# CLI authentication command

import click
import os
import json
import webbrowser
import time
from pathlib import Path
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
from ..api_client import TrainForgeAPIClient

# Auth token storage location
AUTH_FILE = Path.home() / '.trainforge' / 'auth.json'
DASHBOARD_URL = os.environ.get('TRAINFORGE_DASHBOARD', 'http://localhost:3001')

class OAuthCallbackHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'X-Requested-With, Content-type')
        self.end_headers()

    def do_GET(self):
        parsed_path = urlparse(self.path)
        if parsed_path.path == '/callback':
            query_components = parse_qs(parsed_path.query)
            if 'token' in query_components:
                token = query_components['token'][0]
                
                # Save token
                AUTH_FILE.parent.mkdir(parents=True, exist_ok=True)
                
                auth_data = {
                    'token': token,
                    'is_admin': False, # Can be determined by API later
                    'login_time': time.strftime("%Y-%m-%d %H:%M:%S")
                }
                
                # If we need email or admin status, we can decode the JWT token (or fetch from API later)
                with open(AUTH_FILE, 'w') as f:
                    json.dump(auth_data, f, indent=2)
                
                self.send_response(200)
                self.send_header('Content-type', 'text/html')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                html_response = """
                <html>
                <head><title>Authentication Successful</title></head>
                <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                    <h1 style="color: green;">✅ Successfully authenticated!</h1>
                    <p>You can close this window and return to your terminal.</p>
                    <script>
                        // Try to close window automatically
                        setTimeout(() => window.close(), 2000);
                    </script>
                </body>
                </html>
                """
                self.wfile.write(html_response.encode('utf-8'))
                
                # Signal the server to stop
                self.server.token_received = True
            else:
                self.send_response(400)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                self.wfile.write(b"<html><body><h1>Authentication failed! No token received.</h1></body></html>")
                self.server.token_received = False
                
        # Send a blank response for favicon and other requests
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        # Suppress logging
        pass


@click.group()
def auth():
    """Authenticate with TrainForge platform"""
    pass

@auth.command()
def login():
    """Log in to TrainForge via browser"""
    
    click.echo("🔄 Starting login process...")
    click.echo("🌐 Opening browser to authenticate...")
    
    try:
        # Start local server to receive the token dynamically picking a port
        server = HTTPServer(('localhost', 0), OAuthCallbackHandler)
        port = server.server_port
        login_url = f"{DASHBOARD_URL}/cli-login?port={port}"
        
        server.timeout = 1 # Non-blocking loop
        server.token_received = None
        
        # Open the browser
        try:
            webbrowser.open(login_url)
        except Exception as e:
            click.echo(click.style(f"❌ Failed to open browser.", fg='red'))
            click.echo(f"Please navigate manually to: {login_url}")
        
        # Wait for the token
        timeoutSeconds = 300 # 5 minutes
        start_time = time.time()
        
        while server.token_received is None and (time.time() - start_time) < timeoutSeconds:
            server.handle_request()
            
        if server.token_received:
            click.echo(click.style("\n✅ Successfully logged into TrainForge!", fg='green'))
            click.echo("\n🚀 You can now use TrainForge CLI commands:")
            click.echo("   • trainforge push       - Submit training job")
            click.echo("   • trainforge status     - Check job status")
        elif server.token_received is False:
            click.echo(click.style("\n❌ Authentication failed.", fg='red'))
        else:
            click.echo(click.style("\n⏳ Login timed out after 5 minutes.", fg='red'))
            
    except OSError as e:
        click.echo(click.style(f"❌ Server error starting local callback server: {e}", fg='red'))
    except Exception as e:
        click.echo(click.style(f"❌ Login failed: {str(e)}", fg='red'))

@auth.command()
def logout():
    """Log out from TrainForge"""

    try:
        if AUTH_FILE.exists():
            # Remove auth file
            AUTH_FILE.unlink()

            click.echo(click.style(f"✅ Successfully logged out", fg='green'))
            click.echo("🔒 Auth token removed")
        else:
            click.echo(click.style("ℹ️  You are not currently logged in", fg='yellow'))

    except Exception as e:
        click.echo(click.style(f"❌ Logout failed: {str(e)}", fg='red'))

@auth.command()
def status():
    """Check authentication status"""

    try:
        if AUTH_FILE.exists():
            with open(AUTH_FILE, 'r') as f:
                auth_data = json.load(f)

            click.echo(click.style("✅ You are logged in", fg='green'))
            click.echo(f"\n⏰ Login time: {auth_data.get('login_time', 'Unknown')}")
            click.echo(f"💾 Token file:  {AUTH_FILE}")
            
            # optionally call API to verify token here
            
        else:
            click.echo(click.style("❌ You are not logged in", fg='red'))
            click.echo("\n💡 Run 'trainforge auth login' to authenticate")

    except Exception as e:
        click.echo(click.style(f"❌ Failed to check status: {str(e)}", fg='red'))

@auth.command()
def token():
    """Display current auth token (for debugging)"""

    try:
        if AUTH_FILE.exists():
            with open(AUTH_FILE, 'r') as f:
                auth_data = json.load(f)

            click.echo(click.style("🔑 Auth Token:", fg='cyan'))
            click.echo(auth_data.get('token', 'No token found'))
        else:
            click.echo(click.style("❌ Not logged in. No token available.", fg='red'))

    except Exception as e:
        click.echo(click.style(f"❌ Failed to read token: {str(e)}", fg='red'))
