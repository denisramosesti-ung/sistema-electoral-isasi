// ======================= SERVICIO DE ESTRUCTURA =======================

import { supabase } from "../supabaseClient";
import { normalizeCI } from "../utils/estructuraHelpers";
import { savePadron, getAllPadron } from "../utils/padronDB";

// ======================= CARGAR ESTRUCTURA COMPLETA =======================
export const cargarEstructuraCompleta = async () => {
  let padron = await getAllPadron();

  // Si no existe en IndexedDB, lo descarga y guarda
  if (!padron || padron.length === 0) {
    const { data } = await supabase
      .from("padron")
      .select("*")
      .range(0, 100000);

    padron = data || [];
    await savePadron(padron);
  }

  const { data: coords } = await supabase.from("coordinadores").select("*");
  const { data: subs } = await supabase.from("subcoordinadores").select("*");
  const { data: votos } = await supabase.from("votantes").select("*");

  // Crear mapa una sola vez
const padronMap = new Map(
  padron.map((p) => [normalizeCI(p.ci), p])
);

const mapPadron = (ci) =>
  padronMap.get(normalizeCI(ci));

  return {
    coordinadores: (coords || []).map((c) => ({ ...c, ...mapPadron(c.ci) })),
    subcoordinadores: (subs || []).map((s) => ({ ...s, ...mapPadron(s.ci) })),
    votantes: (votos || []).map((v) => ({ ...v, ...mapPadron(v.ci) })),
  };
};

// ======================= AGREGAR PERSONA =======================
export const agregarPersonaService = async ({
  persona,
  modalType,
  currentUser,
  estructura,
}) => {
  const ci = normalizeCI(persona.ci);
  let tabla = "";
  let data = {};

  if (modalType === "coordinador") {
    tabla = "coordinadores";
    data = { ci, login_code: persona.login_code };
  }

  if (modalType === "subcoordinador") {
    tabla = "subcoordinadores";
    data = {
      ci,
      coordinador_ci: currentUser.ci,
      login_code: persona.login_code,
    };
  }

  if (modalType === "votante") {
    tabla = "votantes";
    data = {
      ci,
      asignado_por: currentUser.ci,
      coordinador_ci:
        currentUser.role === "coordinador"
          ? currentUser.ci
          : estructura.subcoordinadores.find(
              (s) => normalizeCI(s.ci) === currentUser.ci
            )?.coordinador_ci,
    };
  }

  const { error } = await supabase.from(tabla).insert([data]);
  if (error) throw error;
};

// ======================= ELIMINAR PERSONA =======================
export const eliminarPersonaService = async (ci, tipo, currentUser) => {
  ci = normalizeCI(ci);

  if (tipo === "coordinador" && currentUser.role === "superadmin") {
    await supabase.from("subcoordinadores").delete().eq("coordinador_ci", ci);
    await supabase.from("votantes").delete().eq("coordinador_ci", ci);
    await supabase.from("coordinadores").delete().eq("ci", ci);
  }

  if (tipo === "subcoordinador") {
    await supabase.from("votantes").delete().eq("asignado_por", ci);
    await supabase.from("subcoordinadores").delete().eq("ci", ci);
  }

  if (tipo === "votante") {
    await supabase.from("votantes").delete().eq("ci", ci);
  }
};

// ======================= ACTUALIZAR TELÉFONO =======================
export const actualizarTelefonoService = async (persona, telefono) => {
  let tabla = "votantes";
  if (persona.tipo === "coordinador") tabla = "coordinadores";
  if (persona.tipo === "subcoordinador") tabla = "subcoordinadores";

  const { error } = await supabase
    .from(tabla)
    .update({ telefono })
    .eq("ci", persona.ci);

  if (error) throw error;
};
