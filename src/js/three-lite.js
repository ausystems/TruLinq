/* Only the parts of Three.js the globe needs, so the bundle can tree-shake the rest. */
export { WebGLRenderer, Scene, PerspectiveCamera, Group, Vector3, Mesh, SphereGeometry, MeshBasicMaterial, BufferGeometry, BufferAttribute, Points, PointsMaterial, LineBasicMaterial, Line, QuadraticBezierCurve3 } from 'three';
