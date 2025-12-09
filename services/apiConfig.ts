/**
 * API 配置文件
 * 
 * 局域网部署说明：
 * 当需要让同事通过局域网访问时，将 API_HOST 改为你的本机 IP 地址
 * 例如：const API_HOST = '192.168.1.100';
 * 
 * 获取本机 IP 的方法：
 * - Windows: 在命令行运行 ipconfig，查看 IPv4 地址
 * - Mac/Linux: 在终端运行 ifconfig 或 ip addr
 */

// 开发环境：使用 localhost
// 局域网环境：改为你的本机 IP 地址，如 '192.168.1.100'
const API_HOST = window.location.hostname;  // 自动使用当前访问的主机名

export const API_BASE_URL = `http://${API_HOST}:3001/api`;
export const SOCKET_URL = `http://${API_HOST}:3001`;
