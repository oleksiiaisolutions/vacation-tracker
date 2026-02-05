import http.server
import socketserver
import json
import os
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)
import re

PORT = int(os.environ.get("PORT", 8000))

DB_FILE = 'database.json'

class VacationRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def _read_db(self):
        if not os.path.exists(DB_FILE):
            return []
        with open(DB_FILE, 'r') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return []

    def _save_db(self, data):
        with open(DB_FILE, 'w') as f:
            json.dump(data, f, indent=2)

    def do_GET(self):
        if self.path == '/api/employees':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            data = self._read_db()
            self.wfile.write(json.dumps(data).encode('utf-8'))
        else:
            super().do_GET()

    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        body = self.rfile.read(content_length).decode('utf-8')
        payload = json.loads(body)

        if self.path == '/api/employees':
            # Add Employee
            employees = self._read_db()
            new_emp = payload
            # Ensure ID is present (or generate one if frontend didn't, but frontend does)
            employees.append(new_emp)
            self._save_db(employees)
            
            self.send_response(201)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(new_emp).encode('utf-8'))
            print(f"Added employee: {new_emp['name']}")

        elif re.match(r'/api/employees/(.+)/request', self.path):
            # Add Request
            match = re.search(r'/api/employees/(.+)/request', self.path)
            emp_id = match.group(1)
            employees = self._read_db()
            
            found = False
            for emp in employees:
                if emp['id'] == emp_id:
                    if 'requests' not in emp:
                        emp['requests'] = []
                    emp['requests'].append(payload)
                    found = True
                    break
            
            if found:
                self._save_db(employees)
                self.send_response(201)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(payload).encode('utf-8'))
                print(f"Added request for employee {emp_id}")
            else:
                self.send_error(404, "Employee not found")

        else:
            self.send_error(404, "Endpoint not found")

    def do_DELETE(self):
        if re.match(r'/api/employees/(.+)', self.path):
            match = re.search(r'/api/employees/(.+)', self.path)
            emp_id = match.group(1)
            employees = self._read_db()
            
            new_employees = [e for e in employees if e['id'] != emp_id]
            
            if len(new_employees) < len(employees):
                self._save_db(new_employees)
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'{"status": "deleted"}')
                print(f"Deleted employee {emp_id}")
            else:
                self.send_error(404, "Employee not found")
        else:
            self.send_error(404, "Endpoint not found")

print(f"Starting server on port {PORT}...")
print(f"Serving files from {os.getcwd()}")
with socketserver.TCPServer(("", PORT), VacationRequestHandler) as httpd:
    httpd.serve_forever()
