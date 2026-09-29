const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;



// Set EJS as the view engine
app.set('view engine', 'ejs');

// Serve static assets from public folder
app.use(express.static('public'));

const storeData = {
  hero: {
    title: "LEVEL UP YOUR GEAR",
    subtitle: "Your premier source for high-performance PC components, gaming laptops, console gear, and gaming peripherals in the Philippines.",
    ctaText: "EXPLORE CATALOG",
    ctaLink: "#products"
  },
  // Category list configured with modern Bootstrap 5 Icons
  categories: [
    { 
      name: "Graphics Cards", 
      icon: "bi-gpu-card", 
      itemCount: "5 Products", 
      badge: "In Stock" 
    },
    { 
      name: "Gaming Laptops", 
      icon: "bi-laptop", 
      itemCount: "5 Products", 
      badge: "Popular" 
    },
    { 
      name: "Processors (CPU)", 
      icon: "bi-cpu", 
      itemCount: "5 Products", 
      badge: "Jeson Hot" 
    },
    { 
      name: "Mechanical Keyboards", 
      icon: "bi-keyboard", 
      itemCount: "5 Products", 
      badge: "Hot" 
    },
    { 
      name: "Monitors", 
      icon: "bi-display", 
      itemCount: "5 Products", 
      badge: "Sale" 
    },
    { 
      name: "Headsets & Audio", 
      icon: "bi-headphones", 
      itemCount: "5 Products", 
      badge: null 
    },
    { 
      name: "Gaming Mice", 
      icon: "bi-mouse3", 
      itemCount: "5 Products", 
      badge: "New" 
    },
    { 
      name: "Power Supplies", 
      icon: "bi-plug", 
      itemCount: "5 Products", 
      badge: null 
    }
  ],
  products: [
    {
      id: 1,
      name: "NVIDIA GeForce RTX 4080 Super 16GB",
      category: "Graphics Cards",
      price: "₱68,995",
      oldPrice: "₱74,995",
      image: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=600&q=80",
      badge: "Best Seller"
    },
    {
      id: 2,
      name: "ASUS ROG Strix G16 (2024) Core i9",
      category: "Gaming Laptops",
      price: "₱109,995",
      oldPrice: "₱118,000",
      image: "https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=600&q=80",
      badge: "Hot Deal"
    },
    {
      id: 3,
      name: "AMD Ryzen 7 7800X3D Gaming Processor",
      category: "Processors",
      price: "₱24,850",
      oldPrice: "",
      image: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?auto=format&fit=crop&w=600&q=80",
      badge: "Featured"
    },
    {
      id: 4,
      name: "Razer Huntsman V3 Pro RGB Keyboard",
      category: "Keyboards",
      price: "₱13,995",
      oldPrice: "₱15,200",
      image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80",
      badge: "New"
    },
    {
      id: 5,
      name: "LG UltraGear 27\" OLED 240Hz 0.03ms",
      category: "Monitors",
      price: "₱46,500",
      oldPrice: "₱51,000",
      image: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80",
      badge: "Limited"
    },
    {
      id: 6,
      name: "SteelSeries Arctis Nova Pro Wireless",
      category: "Headsets",
      price: "₱19,800",
      oldPrice: "",
      image: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=600&q=80",
      badge: null
    }
  ]
};

app.get('/', (req, res) => {
  res.render('index', storeData);
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.get('/pcbuild', (req,res)=> {
  res.render('pcbuild')
});

app.listen(PORT, () => {
  console.log(`i.TECH EJS Store running on http://localhost:${PORT}`);
});