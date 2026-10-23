/**
 * ISET N° 57 - Servicio de Autenticación, Roles y Sesión
 * Soporta Supabase Auth con fallback resiliente en localStorage.
 */
(() => {
  "use strict";

  class AuthService {
    constructor() {
      this.config = window.ISET_CONFIG;
      this.supabase = null;
      this.currentUser = null;
      this.listeners = {};
      this.initialized = false;
    }

    on(event, callback) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(callback);
    }

    emit(event, data) {
      if (this.listeners[event]) {
        this.listeners[event].forEach(fn => {
          try { fn(data); } catch (err) { console.error("Error en listener de auth:", err); }
        });
      }
    }

    // Inicializar cliente Supabase o Mock
    async init() {
      if (this.initialized) return this.currentUser;

      const hasValidSupabase = this.config.supabaseUrl &&
        !this.config.supabaseUrl.includes("su-proyecto") &&
        this.config.supabaseAnonKey &&
        window.supabase;

      if (hasValidSupabase) {
        try {
          this.supabase = window.supabase.createClient(
            this.config.supabaseUrl,
            this.config.supabaseAnonKey
          );
          console.log("🟢 Conectado exitosamente a Supabase Auth.");

          // Obtener sesión actual
          const { data: { session } } = await this.supabase.auth.getSession();
          if (session?.user) {
            await this._fetchSupabaseUserProfile(session.user);
          }

          // Escuchar cambios de sesión
          this.supabase.auth.onAuthStateChange(async (event, session) => {
            console.log("Evento Auth Supabase:", event);
            if (event === "PASSWORD_RECOVERY") {
              this.emit("password-recovery-mode", session);
            }
            if (session?.user) {
              await this._fetchSupabaseUserProfile(session.user);
            } else {
              this.currentUser = null;
            }
            this.emit("auth-changed", this.currentUser);
          });
        } catch (err) {
          console.warn("No se pudo conectar a Supabase, usando modo local:", err);
          this._initMockAuth();
        }
      } else {
        console.log("ℹ️ Usando motor de autenticación local resiliente.");
        this._initMockAuth();
      }

      this.initialized = true;
      this.emit("auth-ready", this.currentUser);
      return this.currentUser;
    }

    isLiveSupabase() {
      return Boolean(this.supabase);
    }

    // ----------------------------------------------------
    // Modo Supabase Real
    // ----------------------------------------------------
    async _fetchSupabaseUserProfile(authUser) {
      try {
        let { data: profile, error } = await this.supabase
          .from("profiles")
          .select("*")
          .eq("id", authUser.id)
          .maybeSingle();

        if (!profile && !error) {
          // Si el trigger de la base de datos no creó el perfil aún, crearlo
          const isSuper = this._checkIfSuperuser(authUser.email, false);
          const initialRole = isSuper ? "superuser" : "visitante";
          const initialCarreras = isSuper ? ["digitales", "higiene", "enfermeria", "simulacion"] : [];

          const newProfile = {
            id: authUser.id,
            email: authUser.email,
            full_name: authUser.user_metadata?.full_name || authUser.email.split("@")[0],
            role: initialRole,
            carreras: initialCarreras
          };

          const insertRes = await this.supabase.from("profiles").insert([newProfile]).select().single();
          profile = insertRes.data || newProfile;
        }

        this.currentUser = {
          id: authUser.id,
          email: authUser.email,
          fullName: profile?.full_name || authUser.user_metadata?.full_name || authUser.email,
          role: profile?.role || "visitante",
          carreras: profile?.carreras || [],
          raw: authUser
        };
      } catch (e) {
        console.error("Error obteniendo perfil en Supabase:", e);
        this.currentUser = {
          id: authUser.id,
          email: authUser.email,
          fullName: authUser.email,
          role: this._checkIfSuperuser(authUser.email, false) ? "superuser" : "visitante",
          carreras: []
        };
      }
    }

    // ----------------------------------------------------
    // Modo Local / Mock Resiliente (localStorage)
    // ----------------------------------------------------
    _initMockAuth() {
      const savedSession = localStorage.getItem("iset_current_user");
      if (savedSession) {
        try {
          this.currentUser = JSON.parse(savedSession);
        } catch (_) {
          this.currentUser = null;
        }
      }

      // Asegurar que exista la lista de usuarios mock
      if (!localStorage.getItem("iset_mock_users")) {
        localStorage.setItem("iset_mock_users", JSON.stringify([]));
      }
    }

    _getMockUsers() {
      try {
        return JSON.parse(localStorage.getItem("iset_mock_users") || "[]");
      } catch (_) {
        return [];
      }
    }

    _saveMockUsers(users) {
      localStorage.setItem("iset_mock_users", JSON.stringify(users));
    }

    _checkIfSuperuser(email, isFirstUser) {
      if (!email) return false;
      const cleanEmail = email.trim().toLowerCase();
      const isSuperEmail = this.config.superuserEmails.map(e => e.toLowerCase()).includes(cleanEmail);
      return isSuperEmail || isFirstUser;
    }

    // ----------------------------------------------------
    // Métodos Públicos de Autenticación
    // ----------------------------------------------------
    getCurrentUser() {
      return this.currentUser;
    }

    isLoggedIn() {
      return Boolean(this.currentUser);
    }

    isSuperuser() {
      return this.currentUser?.role === this.config.ROLES.SUPERUSER;
    }

    isAdminOf(carreraId) {
      if (!this.currentUser) return false;
      if (this.isSuperuser()) return true;
      if (this.currentUser.role === this.config.ROLES.ADMIN) {
        return Array.isArray(this.currentUser.carreras) && this.currentUser.carreras.includes(carreraId);
      }
      return false;
    }

    canEdit(carreraId = null) {
      if (!this.currentUser) return false;
      if (this.isSuperuser()) return true;
      if (carreraId) {
        return this.isAdminOf(carreraId);
      }
      // Administradores institucionales pueden editar secciones generales compartidas (ej. FAQ e inscripción)
      if (this.currentUser.role === this.config.ROLES.ADMIN) {
        return true;
      }
      return false;
    }

    // Registro
    async signUp({ email, password, fullName }) {
      const cleanEmail = email.trim().toLowerCase();

      if (this.supabase) {
        const { data, error } = await this.supabase.auth.signUp({
          email: cleanEmail,
          password: password,
          options: {
            data: { full_name: fullName }
          }
        });
        if (error) throw error;
        if (data.user) {
          await this._fetchSupabaseUserProfile(data.user);
          this.emit("auth-changed", this.currentUser);
        }
        return { user: this.currentUser, message: "Registro exitoso en Supabase." };
      }

      // Fallback local
      const users = this._getMockUsers();
      if (users.find(u => u.email.toLowerCase() === cleanEmail)) {
        throw new Error("El correo electrónico ya se encuentra registrado.");
      }

      const isFirst = users.length === 0;
      const isSuper = this._checkIfSuperuser(cleanEmail, isFirst);
      const role = isSuper ? this.config.ROLES.SUPERUSER : this.config.ROLES.VISITANTE;
      const carreras = isSuper ? ["digitales", "higiene", "enfermeria", "simulacion"] : [];

      const newUser = {
        id: "usr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
        email: cleanEmail,
        password: password, // Almacenado localmente para simulación
        fullName: fullName || cleanEmail.split("@")[0],
        role: role,
        carreras: carreras,
        createdAt: new Date().toISOString()
      };

      users.push(newUser);
      this._saveMockUsers(users);

      this.currentUser = {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
        carreras: newUser.carreras
      };
      localStorage.setItem("iset_current_user", JSON.stringify(this.currentUser));
      this.emit("auth-changed", this.currentUser);

      return {
        user: this.currentUser,
        message: isSuper
          ? "¡Cuenta creada como Superusuario con permisos totales!"
          : "¡Cuenta creada con éxito en modo visitante!"
      };
    }

    // Iniciar Sesión
    async signIn({ email, password }) {
      const cleanEmail = email.trim().toLowerCase();

      if (this.supabase) {
        const { data, error } = await this.supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: password
        });
        if (error) throw error;
        if (data.user) {
          await this._fetchSupabaseUserProfile(data.user);
          this.emit("auth-changed", this.currentUser);
        }
        return { user: this.currentUser };
      }

      // Fallback local
      const users = this._getMockUsers();
      const found = users.find(u => u.email.toLowerCase() === cleanEmail && u.password === password);
      if (!found) {
        throw new Error("Correo o contraseña incorrectos.");
      }

      this.currentUser = {
        id: found.id,
        email: found.email,
        fullName: found.fullName,
        role: found.role,
        carreras: found.carreras || []
      };
      localStorage.setItem("iset_current_user", JSON.stringify(this.currentUser));
      this.emit("auth-changed", this.currentUser);
      return { user: this.currentUser };
    }

    // Cerrar Sesión
    async signOut() {
      if (this.supabase) {
        try {
          await this.supabase.auth.signOut();
        } catch (e) {
          console.error("Error al salir de Supabase:", e);
        }
      }
      this.currentUser = null;
      localStorage.removeItem("iset_current_user");
      this.emit("auth-changed", null);
    }

    // Solicitar recuperación de contraseña por email
    async requestPasswordReset(email) {
      const cleanEmail = email.trim().toLowerCase();

      if (this.supabase) {
        const redirectUrl = window.location.origin + window.location.pathname;
        const { error } = await this.supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: redirectUrl
        });
        if (error) throw error;
        return {
          success: true,
          message: "Se envió un correo electrónico con el enlace para restablecer tu contraseña."
        };
      }

      // Fallback local: Generar token simulado
      const users = this._getMockUsers();
      const user = users.find(u => u.email.toLowerCase() === cleanEmail);
      if (!user) {
        // Por seguridad, no revelar si existe o no
        return {
          success: true,
          message: "Si el correo está registrado, recibirás un enlace de recuperación."
        };
      }

      const resetToken = "reset_" + Math.random().toString(36).slice(2);
      sessionStorage.setItem("iset_reset_token", JSON.stringify({ email: cleanEmail, token: resetToken }));

      return {
        success: true,
        mockToken: resetToken,
        message: "Enlace de recuperación generado para " + cleanEmail + ". Podés ingresar tu nueva contraseña ahora."
      };
    }

    // Restablecer contraseña con el token activo
    async updatePassword(newPassword) {
      if (this.supabase) {
        const { error } = await this.supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        return { success: true, message: "Contraseña actualizada exitosamente en Supabase." };
      }

      // Fallback local
      const mockReset = sessionStorage.getItem("iset_reset_token");
      if (mockReset) {
        const { email } = JSON.parse(mockReset);
        const users = this._getMockUsers();
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (user) {
          user.password = newPassword;
          this._saveMockUsers(users);
          sessionStorage.removeItem("iset_reset_token");
          return { success: true, message: "Contraseña restablecida exitosamente." };
        }
      }

      // Si está logueado y cambia su clave
      if (this.currentUser) {
        const users = this._getMockUsers();
        const user = users.find(u => u.id === this.currentUser.id);
        if (user) {
          user.password = newPassword;
          this._saveMockUsers(users);
          return { success: true, message: "Contraseña actualizada exitosamente." };
        }
      }

      throw new Error("No hay una sesión activa de restablecimiento de contraseña.");
    }

    // ----------------------------------------------------
    // Panel de Superusuario: Gestión de Usuarios
    // ----------------------------------------------------
    async listUsers() {
      if (!this.isSuperuser()) {
        throw new Error("Acceso denegado: Se requiere rol de Superusuario.");
      }

      if (this.supabase) {
        const { data, error } = await this.supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: true });
        if (error) throw error;
        return data || [];
      }

      // Fallback local
      return this._getMockUsers().map(u => ({
        id: u.id,
        email: u.email,
        full_name: u.fullName,
        role: u.role,
        carreras: u.carreras || [],
        created_at: u.createdAt
      }));
    }

    async updateUserRole(userId, newRole, assignedCarreras = []) {
      if (!this.isSuperuser()) {
        throw new Error("Acceso denegado: Se requiere rol de Superusuario.");
      }

      if (this.supabase) {
        const { data, error } = await this.supabase
          .from("profiles")
          .update({
            role: newRole,
            carreras: assignedCarreras,
            updated_at: new Date().toISOString()
          })
          .eq("id", userId)
          .select()
          .single();
        if (error) throw error;
        return data;
      }

      // Fallback local
      const users = this._getMockUsers();
      const user = users.find(u => u.id === userId);
      if (!user) throw new Error("Usuario no encontrado.");

      user.role = newRole;
      user.carreras = assignedCarreras;
      this._saveMockUsers(users);

      // Si se auto-actualizó el usuario actual
      if (this.currentUser?.id === userId) {
        this.currentUser.role = newRole;
        this.currentUser.carreras = assignedCarreras;
        localStorage.setItem("iset_current_user", JSON.stringify(this.currentUser));
        this.emit("auth-changed", this.currentUser);
      }

      return user;
    }
  }

  window.ISET_AUTH = new AuthService();
})();
