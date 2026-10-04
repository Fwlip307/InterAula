import json
import os
import re

def clean_name(val):
    if not val:
        return ""
    val = re.sub(r'\s+', ' ', val).strip()
    return val

def title_case_spanish(text):
    if not text:
        return ""
    words = text.split()
    lower_words = {'de', 'del', 'en', 'y', 'e', 'la', 'las', 'el', 'los', 'con', 'para', 'por', 'o', 'u', 'al'}
    result = []
    for idx, w in enumerate(words):
        clean_w = w.strip('.,()')
        if clean_w.upper() in {'UC', 'PUC', 'USACH', 'USM', 'UDEC', 'UDP', 'UAI', 'UNAB', 'USS', 'UDD', 'UACH', 'UV', 'UFRO', 'UCN', 'PUCV', 'UCSC', 'UCM', 'UPLA', 'UTALCA', 'UDLA', 'AIEP', 'INACAP', 'CFT', 'IP', 'IACC', 'UNIACC', 'IPG', 'EATRI', 'ENAC', 'IPLACEX'}:
            result.append(w.upper())
        elif idx > 0 and w.lower() in lower_words:
            result.append(w.lower())
        else:
            result.append(w.capitalize())
    return ' '.join(result)

def format_institution_name(name_raw, tipo):
    name_upper = name_raw.upper()
    if 'DUOC' in name_upper:
        return 'Duoc UC'
    if 'INACAP' in name_upper and tipo == 'IP':
        return 'INACAP (Instituto Profesional)'
    if 'INACAP' in name_upper and tipo == 'Universidad':
        return 'Universidad Tecnológica de Chile INACAP'
    if 'PONTIFICIA UNIVERSIDAD CATÓLICA DE CHILE' in name_upper or 'PONTIFICIA UNIVERSIDAD CATOLICA DE CHILE' in name_upper:
        return 'Pontificia Universidad Católica de Chile (PUC)'
    if 'UNIVERSIDAD DE CHILE' == name_upper:
        return 'Universidad de Chile'
    if 'UNIVERSIDAD DE SANTIAGO DE CHILE' in name_upper:
        return 'Universidad de Santiago de Chile (USACH)'
    if 'FEDERICO SANTA MAR' in name_upper:
        return 'Universidad Técnica Federico Santa María (USM)'
    if 'PONTIFICIA UNIVERSIDAD CATÓLICA DE VALPARAÍSO' in name_upper or 'PONTIFICIA UNIVERSIDAD CATOLICA DE VALPARAISO' in name_upper:
        return 'Pontificia Universidad Católica de Valparaíso (PUCV)'
    return title_case_spanish(name_raw)

def main():
    source_file = 'catalogo_anidado.json'
    if not os.path.exists(source_file):
        alt = r'C:\Users\marti_d4ww26d\Downloads\catalogo_anidado.json'
        if os.path.exists(alt):
            source_file = alt
        else:
            print('No se encontro catalogo_anidado.json')
            return

    print(f'Leyendo {source_file}...')
    with open(source_file, encoding='utf-8', errors='ignore') as f:
        data = json.load(f)

    instituciones_raw = data.get('instituciones', [])
    print(f'Procesando {len(instituciones_raw)} instituciones anidadas...')

    final_list = []
    total_careers = 0

    for inst in instituciones_raw:
        iid = inst.get('institucion_id', '').strip()
        name_raw = inst.get('nombre', '').strip()
        tipo = inst.get('tipo', '').strip()
        display_name = format_institution_name(name_raw, tipo)

        # Sedes
        sedes_list = []
        for s in inst.get('sedes', []):
            sedes_list.append({
                'id': s.get('sede_id', '').strip(),
                'name': title_case_spanish(s.get('nombre', '').strip()),
                'region': s.get('region', '').strip(),
                'comuna': s.get('comuna', '').strip()
            })

        # Carreras y detalles
        career_names_set = set()
        career_details = []
        areas_set = set()

        for c in inst.get('carreras', []):
            total_careers += 1
            cname = clean_name(c.get('nombre', ''))
            if not cname:
                continue
            display_cname = title_case_spanish(cname)
            career_names_set.add(display_cname)

            area = title_case_spanish(c.get('area', '').strip())
            if area:
                areas_set.add(area)

            # Sedes asociadas a esta carrera
            c_sedes = set()
            for prog in c.get('programas', []):
                sid = prog.get('sede_id', '').strip()
                if sid:
                    c_sedes.add(sid)

            career_details.append({
                'id': c.get('carrera_id', '').strip(),
                'name': display_cname,
                'area': area or 'General',
                'nivel': c.get('nivel', '').strip() or 'Pregrado',
                'sedes': sorted(list(c_sedes))
            })

        sorted_careers = sorted(list(career_names_set), key=lambda x: x.lower())
        sorted_areas = sorted(list(areas_set), key=lambda x: x.lower())

        final_list.append({
            'id': iid,
            'name': display_name,
            'type': 'Universidad' if tipo == 'Universidad' else ('Instituto Profesional' if tipo == 'IP' else 'Centro de Formación Técnica'),
            'active': inst.get('vigencia_mineduc') == 'VIGENTE',
            'careersCount': len(sorted_careers),
            'careers': sorted_careers,
            'careerDetails': career_details,
            'areas': sorted_areas,
            'sedes': sedes_list
        })

    # Ordenar instituciones alfabéticamente
    final_list.sort(key=lambda x: x['name'].lower())

    output_path = os.path.join('src', 'data', 'chileanInstitutionsCatalog.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(final_list, f, ensure_ascii=False, indent=2)

    file_size_kb = os.path.getsize(output_path) / 1024
    print(f'Catalogo enriquecido generado en {output_path} ({file_size_kb:.1f} KB)')
    print(f'Total Instituciones: {len(final_list)}')
    print(f'Total Carreras procesadas: {total_careers}')

    duoc = next((i for i in final_list if 'Duoc' in i['name']), None)
    if duoc:
        print(f"Duoc UC: {duoc['careersCount']} carreras, {len(duoc['sedes'])} sedes, {len(duoc['areas'])} areas ({', '.join(duoc['areas'][:4])}...)")

if __name__ == '__main__':
    main()
