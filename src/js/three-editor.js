// Three.js Editor Setup for BeautyBite Mouthguard Customization
// Version: Three.js r128

class ThreeEditor {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.model = null;
        this.currentModel = null;
        this.lights = {};
        this.customizations = [];
        this.isLoading = false;

        // Model paths
        this.modelPaths = {
            basic: 'mg.glb',
            advanced: 'Dental_Guard_Design_D_1109194233_generate.glb'
        };

        this.init();
    }

    init() {
        try {
            this.setupScene();
            this.setupCamera();
            this.setupRenderer();
            this.setupControls();
            this.setupLighting();
            this.loadDefaultModel();
            this.setupEventListeners();
            this.animate();

            // Hide loading overlay
            setTimeout(() => {
                const overlay = document.getElementById('loading-overlay');
                if (overlay) overlay.style.display = 'none';
            }, 1000);

        } catch (error) {
            console.error('Failed to initialize Three.js editor:', error);
            this.showError('Failed to initialize 3D editor: ' + error.message);
        }
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf8f9fa);

        // Add a grid helper for better spatial reference
        const gridHelper = new THREE.GridHelper(10, 10, 0x000000, 0x000000);
        gridHelper.material.opacity = 0.1;
        gridHelper.material.transparent = true;
        this.scene.add(gridHelper);
    }

    setupCamera() {
        const canvas = document.getElementById('threejs-canvas');
        const width = canvas.clientWidth || window.innerWidth;
        const height = canvas.clientHeight || 600;

        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        this.camera.position.set(0, 2, 5);
        this.camera.lookAt(0, 0, 0);
    }

    setupRenderer() {
        const canvas = document.getElementById('threejs-canvas');

        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true
        });

        const width = canvas.clientWidth || window.innerWidth;
        const height = canvas.clientHeight || 600;

        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        if (THREE.sRGBEncoding) this.renderer.outputEncoding = THREE.sRGBEncoding;
        if (THREE.ACESFilmicToneMapping) {
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1;
        }
    }

    setupControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 10;
        this.controls.maxPolarAngle = Math.PI;

        // Set initial control mode to rotate
        this.setControlMode('rotate');
    }

    setupLighting() {
        // Ambient light
        this.lights.ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(this.lights.ambient);

        // Directional light (main key light)
        this.lights.directional = new THREE.DirectionalLight(0xffffff, 0.8);
        this.lights.directional.position.set(5, 5, 5);
        this.lights.directional.castShadow = true;
        this.scene.add(this.lights.directional);

        // Fill light
        this.lights.fill = new THREE.DirectionalLight(0xffffff, 0.3);
        this.lights.fill.position.set(-5, 3, -5);
        this.scene.add(this.lights.fill);

        // Rim light
        this.lights.rim = new THREE.DirectionalLight(0xffffff, 0.4);
        this.lights.rim.position.set(0, 5, -5);
        this.scene.add(this.lights.rim);
    }

    setLightingPreset(preset) {
        switch (preset) {
            case 'studio':
                this.lights.ambient.intensity = 0.6;
                this.lights.directional.intensity = 0.8;
                this.lights.fill.intensity = 0.3;
                this.lights.rim.intensity = 0.4;
                break;
            case 'natural':
                this.lights.ambient.intensity = 0.8;
                this.lights.directional.intensity = 0.6;
                this.lights.fill.intensity = 0.4;
                this.lights.rim.intensity = 0.2;
                break;
            case 'dramatic':
                this.lights.ambient.intensity = 0.4;
                this.lights.directional.intensity = 1.0;
                this.lights.fill.intensity = 0.2;
                this.lights.rim.intensity = 0.6;
                break;
        }
    }

    async loadDefaultModel() {
        try {
            this.isLoading = true;
            await this.loadModel(this.modelPaths.basic);
        } catch (error) {
            console.error('Failed to load default model:', error);
            this.showError('Failed to load 3D model. Please check the model file.');
        } finally {
            this.isLoading = false;
        }
    }

    async loadModel(modelPath) {
        return new Promise((resolve, reject) => {
            const loader = new THREE.GLTFLoader();

            loader.load(
                modelPath,
                (gltf) => {
                    // Remove existing model if present
                    if (this.model) {
                        this.scene.remove(this.model);
                    }

                    this.model = gltf.scene;
                    this.model.name = 'mouthguard';

                    // Center and scale the model
                    const box = new THREE.Box3().setFromObject(this.model);
                    const center = box.getCenter(new THREE.Vector3());
                    const size = box.getSize(new THREE.Vector3());

                    this.model.position.x = -center.x;
                    this.model.position.y = -center.y;
                    this.model.position.z = -center.z;

                    // Scale to fit view
                    const maxDim = Math.max(size.x, size.y, size.z) || 1;
                    const scale = 2 / maxDim;
                    this.model.scale.setScalar(scale);

                    // Enable shadows and set material properties
                    this.model.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;

                            // Store original material for reset functionality
                            if (!child.userData.originalMaterial) {
                                try {
                                    child.userData.originalMaterial = child.material.clone();
                                } catch (err) {
                                    // Some materials may not be clonable; ignore safely
                                }
                            }
                        }
                    });

                    this.scene.add(this.model);
                    this.currentModel = modelPath;

                    // Update design info if element exists
                    try { this.updateDesignInfo(); } catch (e) { /* ignore */ }

                    resolve(this.model);
                },
                (progress) => {
                    // Progress callback - could update a progress bar
                    if (progress && progress.total) {
                        const percent = ((progress.loaded / progress.total) * 100).toFixed(2);
                        console.log(`Loading model: ${percent}%`);
                    }
                },
                (error) => {
                    reject(error);
                }
            );
        });
    }

    setControlMode(mode) {
        if (!this.controls) return;

        switch (mode) {
            case 'rotate':
                this.controls.enableRotate = true;
                this.controls.enableZoom = true;
                this.controls.enablePan = false;
                break;
            case 'zoom':
                this.controls.enableRotate = false;
                this.controls.enableZoom = true;
                this.controls.enablePan = false;
                break;
            case 'pan':
                this.controls.enableRotate = false;
                this.controls.enableZoom = false;
                this.controls.enablePan = true;
                break;
        }

        // Update UI buttons
        document.querySelectorAll('.control-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const btn = document.getElementById(`${mode}-model`);
        if (btn) btn.classList.add('active');
    }

    addText(textData) {
        if (!this.model) return null;

        const { text, font, size, position, color, effect } = textData;

        // Create text geometry (simplified - in production, use proper font loading)
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128;

        context.fillStyle = color || '#000';
        context.font = `${size || 12}px ${font || 'Arial'}`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true
        });

        const geometry = new THREE.PlaneGeometry(1, 0.25);
        const textMesh = new THREE.Mesh(geometry, material);

        // Position based on selection
        this.positionElement(textMesh, position);

        // Apply effect
        this.applyTextEffect(textMesh, effect);

        textMesh.userData = {
            type: 'text',
            ...textData,
            createdAt: new Date().toISOString()
        };

        this.scene.add(textMesh);
        this.customizations.push(textMesh);
        this.updateDesignInfo();

        return textMesh;
    }

    addImage(imageData) {
        if (!this.model) return null;

        const { image, position, effect, scale, rotation } = imageData;

        const texture = new THREE.TextureLoader().load(URL.createObjectURL(image));
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true
        });

        const geometry = new THREE.PlaneGeometry(1, 1);
        const imageMesh = new THREE.Mesh(geometry, material);

        // Position and scale
        this.positionElement(imageMesh, position);
        imageMesh.scale.setScalar(scale || 1);
        imageMesh.rotation.y = THREE.MathUtils.degToRad(rotation || 0);

        // Apply effect
        this.applyImageEffect(imageMesh, effect);

        imageMesh.userData = {
            type: 'image',
            ...imageData,
            createdAt: new Date().toISOString()
        };

        this.scene.add(imageMesh);
        this.customizations.push(imageMesh);
        this.updateDesignInfo();

        return imageMesh;
    }

    positionElement(element, position) {
        const positions = {
            front: { x: 0, y: 0.5, z: 0.6 },
            back: { x: 0, y: 0.5, z: -0.6 },
            left: { x: -0.8, y: 0.5, z: 0 },
            right: { x: 0.8, y: 0.5, z: 0 }
        };

        const pos = positions[position] || positions.front;
        element.position.set(pos.x, pos.y, pos.z);
    }

    applyTextEffect(mesh, effect) {
        switch (effect) {
            case 'embossed':
                if (mesh.material) {
                    mesh.material.color = new THREE.Color(0xcccccc);
                }
                break;
            case 'engraved':
                if (mesh.material) {
                    mesh.material.color = new THREE.Color(0x333333);
                }
                break;
            case 'raised':
                mesh.position.y += 0.05;
                break;
        }
    }

    applyImageEffect(mesh, effect) {
        // Similar to text effects but for images
        switch (effect) {
            case 'embossed':
                if (mesh.material) mesh.material.emissive = new THREE.Color(0x222222);
                break;
            case 'engraved':
                if (mesh.material) mesh.material.color = new THREE.Color(0x666666);
                break;
        }
    }

    changeBaseColor(color) {
        if (!this.model) return;

        this.model.traverse((child) => {
            if (child.isMesh && child.material) {
                try {
                    child.material.color = new THREE.Color(color);
                } catch (e) { /* ignore */ }
            }
        });
    }

    changeMaterial(materialType) {
        if (!this.model) return;

        this.model.traverse((child) => {
            if (child.isMesh && child.material) {
                switch (materialType) {
                    case 'matte':
                        child.material.roughness = 0.9;
                        child.material.metalness = 0.1;
                        break;
                    case 'glossy':
                        child.material.roughness = 0.1;
                        child.material.metalness = 0.3;
                        break;
                    case 'metallic':
                        child.material.roughness = 0.2;
                        child.material.metalness = 0.8;
                        break;
                    case 'transparent':
                        child.material.transparent = true;
                        child.material.opacity = 0.7;
                        break;
                }
            }
        });
    }

    resetDesign() {
        // Remove all customizations
        this.customizations.forEach(customization => {
            this.scene.remove(customization);
        });
        this.customizations = [];

        // Reset model to original state
        if (this.model) {
            this.model.traverse((child) => {
                if (child.isMesh && child.userData.originalMaterial) {
                    try {
                        child.material = child.userData.originalMaterial.clone();
                    } catch (e) { /* ignore */ }
                }
            });
        }

        this.updateDesignInfo();
    }

    updateDesignInfo() {
        const textCountEl = document.getElementById('text-count');
        const imageCountEl = document.getElementById('image-count');
        const textCount = this.customizations.filter(c => c.userData?.type === 'text').length;
        const imageCount = this.customizations.filter(c => c.userData?.type === 'image').length;

        if (textCountEl) textCountEl.textContent = textCount;
        if (imageCountEl) imageCountEl.textContent = imageCount;
    }

    exportImage() {
        if (!this.renderer) return;

        this.renderer.render(this.scene, this.camera);
        const dataURL = this.renderer.domElement.toDataURL('image/png');

        // Create download link
        const link = document.createElement('a');
        link.download = 'beautybite-custom-design.png';
        link.href = dataURL;
        link.click();
    }

    generateThumbnail() {
        if (!this.renderer || !this.model) return null;

        // Render to offscreen canvas for thumbnail
        this.renderer.render(this.scene, this.camera);
        return this.renderer.domElement.toDataURL('image/png');
    }

    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.onWindowResize());

        // Control mode buttons
        const rotateBtn = document.getElementById('rotate-model');
        const zoomBtn = document.getElementById('zoom-model');
        const panBtn = document.getElementById('pan-model');
        if (rotateBtn) rotateBtn.addEventListener('click', () => this.setControlMode('rotate'));
        if (zoomBtn) zoomBtn.addEventListener('click', () => this.setControlMode('zoom'));
        if (panBtn) panBtn.addEventListener('click', () => this.setControlMode('pan'));

        // Reset view
        const resetViewBtn = document.getElementById('reset-view');
        if (resetViewBtn) resetViewBtn.addEventListener('click', () => {
            if (this.controls) this.controls.reset();
        });

        // Lighting preset
        const lightingPreset = document.getElementById('lighting-preset');
        if (lightingPreset) lightingPreset.addEventListener('change', (e) => {
            this.setLightingPreset(e.target.value);
        });
    }

    onWindowResize() {
        if (!this.camera || !this.renderer) return;

        const canvas = document.getElementById('threejs-canvas');
        const width = canvas.clientWidth || window.innerWidth;
        const height = canvas.clientHeight || 600;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (this.controls) {
            this.controls.update();
        }

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    showError(message) {
        const errorOverlay = document.getElementById('error-overlay');
        const errorMessage = document.getElementById('error-message');

        if (errorMessage) errorMessage.textContent = message;
        if (errorOverlay) errorOverlay.style.display = 'flex';

        const loading = document.getElementById('loading-overlay');
        if (loading) loading.style.display = 'none';
    }

    // Public methods for other modules
    getDesignData() {
        return {
            model: this.currentModel,
            customizations: this.customizations.map(c => c.userData),
            timestamp: new Date().toISOString()
        };
    }

    loadDesignData(designData) {
        this.resetDesign();

        // Load model if different
        if (designData.model && designData.model !== this.currentModel) {
            this.loadModel(designData.model);
        }

        // Apply customizations
        if (designData.customizations) {
            designData.customizations.forEach(customization => {
                if (customization.type === 'text') {
                    this.addText(customization);
                } else if (customization.type === 'image') {
                    // Note: Image data would need to be recreated from stored data
                    console.log('Image customizations would need special handling');
                }
            });
        }
    }
}

// Initialize Three.js editor when DOM is loaded
let threeEditor;

document.addEventListener('DOMContentLoaded', () => {
    if (typeof THREE !== 'undefined' && typeof THREE.GLTFLoader !== 'undefined') {
        threeEditor = new ThreeEditor();
    } else {
        // If three.js libs not loaded yet, try again shortly
        setTimeout(() => {
            if (typeof THREE !== 'undefined' && typeof THREE.GLTFLoader !== 'undefined') {
                threeEditor = new ThreeEditor();
            } else {
                console.warn('Three.js or loaders not available yet.');
            }
        }, 500);
    }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ThreeEditor };
}