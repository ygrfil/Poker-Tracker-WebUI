# Fix Port 80 Conflict on Ubuntu

## Check what's using port 80
```bash
# See what's running on port 80
sudo netstat -tlnp | grep :80
# OR
sudo lsof -i :80
```

## Stop the conflicting service
```bash
# If it's Apache
sudo systemctl stop apache2
sudo systemctl disable apache2

# If it's Nginx
sudo systemctl stop nginx
sudo systemctl disable nginx

# If it's another Node.js app
sudo pkill -f node
```

## Then start your app
```bash
npm start
```

## Alternative: Use different port
If you want to keep the other service running, modify server.js to use a different port:

```javascript
const PORT = process.env.PORT || 3000;  // Change from 80 to 3000
```

Then access via: `http://your-server-ip:3000`