# cloudnest-server

A full-featured Google Drive Clone backend built with **Node.js and Express**, supporting file uploads to Supabase Storage, secure file sharing, folder management, trash, and versioning.

## 🚀 Features

- JWT & Google OAuth Authentication
- File Uploads to Supabase Storage
- Folder Hierarchy with Soft Delete & Trash
- Secure File Sharing via Signed URLs
- Full-text Search, Pagination, and Role-based Permissions

## 📦 Tech Stack

- Node.js, Express
- MongoDB + Mongoose
- Supabase Storage SDK
- JWT + Bcrypt
- Multer (for handling file uploads)

## 🔧 Installation

```bash
git clone https://github.com/gitfaizankhan/cloudnest-server.git
cd cloudnest-server
npm install
cp .env.example .env
npm run dev
