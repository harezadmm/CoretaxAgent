# Graph Report - coretax-ai-agent  (2026-08-24)

## Corpus Check
- Corpus is ~6,353 words - fits in a single context window. You may not need a graph.

## Summary
- 179 nodes · 206 edges · 13 communities
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Role dan Impersonate
- Bukti Potong
- e-Faktur
- Grounding dan Safety
- Akses dan Aktivasi
- Registrasi dan Profil
- SPT dan Pelaporan
- Source Governance
- Kode Otorisasi
- Billing dan Deposit
- Intent Real Task
- Layanan dan Handover
- Navigasi Coretax

## God Nodes (most connected - your core abstractions)
1. `Glosarium Istilah Coretax untuk Retrieval` - 22 edges
2. `Bukti Potong PPh, eBupot, XML, dan NITKU` - 21 edges
3. `e-Faktur, Faktur Pajak, XML, Approval, dan Pajak Masukan` - 20 edges
4. `Pendaftaran, NIK/NPWP, TKU, dan Perubahan Data Profil` - 17 edges
5. `Akses, Aktivasi, Atur Ulang Kata Sandi, dan Keamanan` - 15 edges
6. `PIC, Pihak Terkait, Role, dan Impersonate` - 15 edges
7. `Katalog Intent dan Parafrasa Pertanyaan Real Task` - 15 edges
8. `Pelaporan SPT, Posting, Pembayaran, dan Status Akhir` - 14 edges
9. `Kontrak Grounding dan Keselamatan Agen Coretax` - 13 edges
10. `Kebijakan Prioritas Sumber dan Pembaruan Corpus` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Pendaftaran, NIK/NPWP, TKU, dan Perubahan Data Profil` --cites--> `akses-bagi-bukan-wp`  [EXTRACTED]
  knowledge/curated/04-registration-identity-and-profile-data.md → knowledge/curated/02-access-activation-and-security.md
- `Playbook Troubleshooting Coretax Berbasis Gejala` --conceptually_related_to--> `Katalog Intent dan Parafrasa Pertanyaan Real Task`  [INFERRED]
  knowledge/curated/11-troubleshooting-playbook.md → knowledge/curated/12-real-task-intent-catalog.md
- `Katalog Intent dan Parafrasa Pertanyaan Real Task` --conceptually_related_to--> `Kebijakan Prioritas Sumber dan Pembaruan Corpus`  [INFERRED]
  knowledge/curated/12-real-task-intent-catalog.md → knowledge/curated/13-source-priority-and-update-policy.md
- `Skenario Evaluasi Real Task dan Keputusan Eskalasi` --conceptually_related_to--> `Glosarium Istilah Coretax untuk Retrieval`  [INFERRED]
  knowledge/curated/14-real-task-evaluation-scenarios.md → knowledge/curated/15-coretax-terminology-glossary.md
- `Glosarium Istilah Coretax untuk Retrieval` --cites--> `akses-coretax-bagi-user-djp-online`  [EXTRACTED]
  knowledge/curated/15-coretax-terminology-glossary.md → knowledge/curated/02-access-activation-and-security.md

## Hyperedges (group relationships)
- **Kontrak Grounding dan Keselamatan Agen Coretax** — knowledge_curated_00_agent_grounding_and_safety_kontrak_grounding_dan_keselamatan_agen_coretax, knowledge_curated_00_agent_grounding_and_safety_tujuan_layanan, knowledge_curated_00_agent_grounding_and_safety_prioritas_sumber, knowledge_curated_00_agent_grounding_and_safety_batas_jawaban_otomatis, knowledge_curated_00_agent_grounding_and_safety_larangan_pengumpulan_rahasia, knowledge_curated_00_agent_grounding_and_safety_format_jawaban_yang_diharapkan, knowledge_curated_00_agent_grounding_and_safety_bahasa_dan_istilah, knowledge_curated_00_agent_grounding_and_safety_sumber_dasar [EXTRACTED 1.00]
- **Peta Modul dan Navigasi Coretax DJP** — knowledge_curated_01_coretax_map_and_navigation_peta_modul_dan_navigasi_coretax_djp, knowledge_curated_01_coretax_map_and_navigation_gambaran_umum, knowledge_curated_01_coretax_map_and_navigation_peta_menu_berdasarkan_intent, knowledge_curated_01_coretax_map_and_navigation_disambiguasi_yang_wajib_dilakukan, knowledge_curated_01_coretax_map_and_navigation_cara_memakai_peta_ini_saat_retrieval, knowledge_curated_01_coretax_map_and_navigation_sumber_dasar [EXTRACTED 1.00]
- **Akses, Aktivasi, Atur Ulang Kata Sandi, dan Keamanan** — knowledge_curated_02_access_activation_and_security_akses_aktivasi_atur_ulang_kata_sandi_dan_keamanan, knowledge_curated_02_access_activation_and_security_decision_tree_akses_pertama_kali, knowledge_curated_02_access_activation_and_security_pengguna_djp_online, knowledge_curated_02_access_activation_and_security_belum_memiliki_atau_belum_pernah_menggunakan_djp_online, knowledge_curated_02_access_activation_and_security_belum_terdaftar_sebagai_wajib_pajak, knowledge_curated_02_access_activation_and_security_lupa_email_atau_nomor_telepon, knowledge_curated_02_access_activation_and_security_setelah_berhasil_masuk, knowledge_curated_02_access_activation_and_security_pemeriksaan_keamanan [EXTRACTED 1.00]
- **Kode Otorisasi DJP dan Sertifikat Digital** — knowledge_curated_03_code_authorization_and_digital_certificate_kode_otorisasi_djp_dan_sertifikat_digital, knowledge_curated_03_code_authorization_and_digital_certificate_fungsi_dan_istilah, knowledge_curated_03_code_authorization_and_digital_certificate_alur_permintaan, knowledge_curated_03_code_authorization_and_digital_certificate_validasi_status, knowledge_curated_03_code_authorization_and_digital_certificate_incorrect_signer_passphrase, knowledge_curated_03_code_authorization_and_digital_certificate_pertanyaan_tentang_masa_berlaku, knowledge_curated_03_code_authorization_and_digital_certificate_batas_keamanan [EXTRACTED 1.00]
- **Pendaftaran, NIK/NPWP, TKU, dan Perubahan Data Profil** — knowledge_curated_04_registration_identity_and_profile_data_pendaftaran_nik_npwp_tku_dan_perubahan_data_profil, knowledge_curated_04_registration_identity_and_profile_data_pilih_alur_sebelum_menjawab, knowledge_curated_04_registration_identity_and_profile_data_identitas_dan_validasi, knowledge_curated_04_registration_identity_and_profile_data_perubahan_data_dua_rumpun_menu, knowledge_curated_04_registration_identity_and_profile_data_portal_saya_perubahan_data, knowledge_curated_04_registration_identity_and_profile_data_portal_saya_profil_saya_informasi_umum_edit, knowledge_curated_04_registration_identity_and_profile_data_tku_dan_unit_keluarga, knowledge_curated_04_registration_identity_and_profile_data_rekening_bank [EXTRACTED 1.00]
- **PIC, Pihak Terkait, Role, dan Impersonate** — knowledge_curated_05_pic_role_and_impersonate_pic_pihak_terkait_role_dan_impersonate, knowledge_curated_05_pic_role_and_impersonate_model_akses, knowledge_curated_05_pic_role_and_impersonate_cara_impersonate_secara_umum, knowledge_curated_05_pic_role_and_impersonate_jika_menu_hilang_atau_permission_error, knowledge_curated_05_pic_role_and_impersonate_kendala_impersonate, knowledge_curated_05_pic_role_and_impersonate_batas_keamanan_dan_privasi [EXTRACTED 1.00]
- **Kode Billing, Pembayaran SPT, dan Deposit Pajak** — knowledge_curated_06_billing_payment_and_deposit_kode_billing_pembayaran_spt_dan_deposit_pajak, knowledge_curated_06_billing_payment_and_deposit_bedakan_tiga_intent, knowledge_curated_06_billing_payment_and_deposit_spt_kurang_bayar_setelah_bayar_dan_lapor, knowledge_curated_06_billing_payment_and_deposit_pembayaran_tagihan_dengan_deposit, knowledge_curated_06_billing_payment_and_deposit_deposit_dan_kode_billing_tidak_digabung, knowledge_curated_06_billing_payment_and_deposit_jejak_dokumen_dan_status, knowledge_curated_06_billing_payment_and_deposit_deposit_yang_sensitif_terhadap_waktu, knowledge_curated_06_billing_payment_and_deposit_eskalasi [EXTRACTED 1.00]
- **Bukti Potong PPh, eBupot, XML, dan NITKU** — knowledge_curated_07_bupot_and_withholding_bukti_potong_pph_ebupot_xml_dan_nitku, knowledge_curated_07_bupot_and_withholding_dua_jalur_pembuatan_yang_umum, knowledge_curated_07_bupot_and_withholding_key_in_manual, knowledge_curated_07_bupot_and_withholding_upload_xml, knowledge_curated_07_bupot_and_withholding_hal_yang_harus_didisambiguasi, knowledge_curated_07_bupot_and_withholding_nitku_dan_unit_kerja, knowledge_curated_07_bupot_and_withholding_kerahasiaan, knowledge_curated_07_bupot_and_withholding_eskalasi_teknis [EXTRACTED 1.00]
- **e-Faktur, Faktur Pajak, XML, Approval, dan Pajak Masukan** — knowledge_curated_08_efaktur_and_input_tax_e_faktur_faktur_pajak_xml_approval_dan_pajak_masukan, knowledge_curated_08_efaktur_and_input_tax_tiga_skema_pembuatan, knowledge_curated_08_efaktur_and_input_tax_key_in_dan_upload_xml, knowledge_curated_08_efaktur_and_input_tax_key_in, knowledge_curated_08_efaktur_and_input_tax_xml, knowledge_curated_08_efaktur_and_input_tax_penandatanganan, knowledge_curated_08_efaktur_and_input_tax_intent_faktur_yang_sering_tertukar, knowledge_curated_08_efaktur_and_input_tax_data_dan_akses [EXTRACTED 1.00]
- **Pelaporan SPT, Posting, Pembayaran, dan Status Akhir** — knowledge_curated_09_spt_reporting_and_statuses_pelaporan_spt_posting_pembayaran_dan_status_akhir, knowledge_curated_09_spt_reporting_and_statuses_alur_umum_spt_tahunan_orang_pribadi, knowledge_curated_09_spt_reporting_and_statuses_alur_spt_tahunan_badan, knowledge_curated_09_spt_reporting_and_statuses_spt_masa, knowledge_curated_09_spt_reporting_and_statuses_status_yang_harus_dibedakan, knowledge_curated_09_spt_reporting_and_statuses_normal_vs_pembetulan, knowledge_curated_09_spt_reporting_and_statuses_batas_jawaban [EXTRACTED 1.00]
- **Layanan Administrasi, Informasi, Pengaduan, dan Handover** — knowledge_curated_10_administrative_services_and_complaints_layanan_administrasi_informasi_pengaduan_dan_handover, knowledge_curated_10_administrative_services_and_complaints_permohonan_layanan_administrasi, knowledge_curated_10_administrative_services_and_complaints_pengaduan_saran_dan_apresiasi_di_coretax, knowledge_curated_10_administrative_services_and_complaints_kanal_resmi_eksternal, knowledge_curated_10_administrative_services_and_complaints_handover_dari_agent [EXTRACTED 1.00]
- **Playbook Troubleshooting Coretax Berbasis Gejala** — knowledge_curated_11_troubleshooting_playbook_playbook_troubleshooting_coretax_berbasis_gejala, knowledge_curated_11_troubleshooting_playbook_pola_diagnosis_umum, knowledge_curated_11_troubleshooting_playbook_gejala_dan_rujukan_utama, knowledge_curated_11_troubleshooting_playbook_rules_untuk_error_teknis, knowledge_curated_11_troubleshooting_playbook_jalur_eskalasi [EXTRACTED 1.00]
- **Katalog Intent dan Parafrasa Pertanyaan Real Task** — knowledge_curated_12_real_task_intent_catalog_katalog_intent_dan_parafrasa_pertanyaan_real_task, knowledge_curated_12_real_task_intent_catalog_akses_dan_aktivasi, knowledge_curated_12_real_task_intent_catalog_kode_otorisasi_dan_tanda_tangan, knowledge_curated_12_real_task_intent_catalog_pendaftaran_data_dan_keluarga, knowledge_curated_12_real_task_intent_catalog_pic_role_dan_impersonate, knowledge_curated_12_real_task_intent_catalog_billing_dan_pembayaran, knowledge_curated_12_real_task_intent_catalog_bukti_potong, knowledge_curated_12_real_task_intent_catalog_faktur_pajak [EXTRACTED 1.00]
- **Kebijakan Prioritas Sumber dan Pembaruan Corpus** — knowledge_curated_13_source_priority_and_update_policy_kebijakan_prioritas_sumber_dan_pembaruan_corpus, knowledge_curated_13_source_priority_and_update_policy_struktur_corpus, knowledge_curated_13_source_priority_and_update_policy_aturan_retrieval, knowledge_curated_13_source_priority_and_update_policy_pembaruan, knowledge_curated_13_source_priority_and_update_policy_time_sensitive_knowledge, knowledge_curated_13_source_priority_and_update_policy_sumber_resmi [EXTRACTED 1.00]
- **Skenario Evaluasi Real Task dan Keputusan Eskalasi** — knowledge_curated_14_real_task_evaluation_scenarios_skenario_evaluasi_real_task_dan_keputusan_eskalasi, knowledge_curated_14_real_task_evaluation_scenarios_jawab_dengan_sumber, knowledge_curated_14_real_task_evaluation_scenarios_eskalasi_karena_data_transaksi, knowledge_curated_14_real_task_evaluation_scenarios_eskalasi_karena_ketidakpastian, knowledge_curated_14_real_task_evaluation_scenarios_kriteria_jawaban_grounded [EXTRACTED 1.00]

## Communities (13 total, 0 thin omitted)

### Community 0 - "Role dan Impersonate"
Cohesion: 0.09
Nodes (26): Batas keamanan dan privasi, Cara impersonate secara umum, Jika menu hilang atau permission error, Kendala impersonate, Model akses, PIC, Pihak Terkait, Role, dan Impersonate, Aturan disambiguasi glosarium, Glosarium Istilah Coretax untuk Retrieval (+18 more)

### Community 1 - "Bukti Potong"
Cohesion: 0.11
Nodes (20): Bukti Potong PPh, eBupot, XML, dan NITKU, Dua jalur pembuatan yang umum, Eskalasi teknis, Hal yang harus didisambiguasi, Kerahasiaan, Key in/manual, NITKU dan unit kerja, Upload XML (+12 more)

### Community 2 - "e-Faktur"
Cohesion: 0.12
Nodes (18): Data dan akses, e-Faktur, Faktur Pajak, XML, Approval, dan Pajak Masukan, Intent faktur yang sering tertukar, Key in, Key in dan upload XML, Penandatanganan, Tiga skema pembuatan, XML (+10 more)

### Community 3 - "Grounding dan Safety"
Cohesion: 0.18
Nodes (14): Bahasa dan istilah, Batas jawaban otomatis, Format jawaban yang diharapkan, Kontrak Grounding dan Keselamatan Agen Coretax, Larangan pengumpulan rahasia, Prioritas sumber, Sumber dasar, Tujuan layanan (+6 more)

### Community 4 - "Akses dan Aktivasi"
Cohesion: 0.15
Nodes (14): Akses, Aktivasi, Atur Ulang Kata Sandi, dan Keamanan, Belum memiliki atau belum pernah menggunakan DJP Online, Belum terdaftar sebagai wajib pajak, Decision tree akses pertama kali, Kendala akses yang perlu diarahkan ke FAQ spesifik, Lupa email atau nomor telepon, Pemeriksaan keamanan, Pengguna DJP Online (+6 more)

### Community 5 - "Registrasi dan Profil"
Cohesion: 0.15
Nodes (14): Identitas dan validasi, Kualitas data, Pendaftaran, NIK/NPWP, TKU, dan Perubahan Data Profil, Perubahan data: dua rumpun menu, Pilih alur sebelum menjawab, Portal Saya > Perubahan Data, Portal Saya > Profil Saya > Informasi Umum > Edit, Rekening bank (+6 more)

### Community 6 - "SPT dan Pelaporan"
Cohesion: 0.17
Nodes (13): Alur SPT Tahunan badan, Alur umum SPT Tahunan orang pribadi, Batas jawaban, Normal vs Pembetulan, Pelaporan SPT, Posting, Pembayaran, dan Status Akhir, SPT masa, Status yang harus dibedakan, bukti-penerimaan-elektronik-bpe-spt-tahunan (+5 more)

### Community 7 - "Source Governance"
Cohesion: 0.20
Nodes (12): Aturan retrieval, Kebijakan Prioritas Sumber dan Pembaruan Corpus, Pembaruan, Struktur corpus, Sumber resmi, Time-sensitive knowledge, Eskalasi karena data/transaksi, Eskalasi karena ketidakpastian (+4 more)

### Community 8 - "Kode Otorisasi"
Cohesion: 0.20
Nodes (11): Alur permintaan, Batas keamanan, Fungsi dan istilah, Incorrect signer passphrase, Kode Otorisasi DJP dan Sertifikat Digital, Pertanyaan tentang masa berlaku, Validasi status, bagaimana-mendapat-kode-otorisasi (+3 more)

### Community 9 - "Billing dan Deposit"
Cohesion: 0.20
Nodes (11): Bedakan tiga intent, Deposit dan kode billing tidak digabung, Deposit yang sensitif terhadap waktu, Eskalasi, Jejak dokumen dan status, Kode Billing, Pembayaran SPT, dan Deposit Pajak, Pembayaran tagihan dengan deposit, SPT kurang bayar setelah Bayar dan Lapor (+3 more)

### Community 10 - "Intent Real Task"
Cohesion: 0.22
Nodes (10): Akses dan aktivasi, Billing dan pembayaran, Bukti potong, Faktur pajak, Katalog Intent dan Parafrasa Pertanyaan Real Task, Kode otorisasi dan tanda tangan, Layanan dan eskalasi, Pendaftaran, data, dan keluarga (+2 more)

### Community 11 - "Layanan dan Handover"
Cohesion: 0.25
Nodes (9): Handover dari agent, Kanal resmi eksternal, Layanan Administrasi, Informasi, Pengaduan, dan Handover, Pengaduan, saran, dan apresiasi di Coretax, Permohonan layanan administrasi, contact, cara-mengakses-layanan-administrasi, pengajuan-layanan-pengaduan (+1 more)

### Community 12 - "Navigasi Coretax"
Cohesion: 0.33
Nodes (7): Cara memakai peta ini saat retrieval, Disambiguasi yang wajib dilakukan, Gambaran umum, Peta menu berdasarkan intent, Peta Modul dan Navigasi Coretax DJP, Sumber dasar, coretax

## Knowledge Gaps
- **140 isolated node(s):** `Tujuan layanan`, `Larangan pengumpulan rahasia`, `Bahasa dan istilah`, `Sumber dasar`, `Gambaran umum` (+135 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Glosarium Istilah Coretax untuk Retrieval` connect `Role dan Impersonate` to `Grounding dan Safety`, `Akses dan Aktivasi`, `Registrasi dan Profil`, `SPT dan Pelaporan`, `Source Governance`?**
  _High betweenness centrality (0.560) - this node is a cross-community bridge._
- **Why does `coretaxpedia` connect `Grounding dan Safety` to `Role dan Impersonate`, `Intent Real Task`, `Navigasi Coretax`, `Source Governance`?**
  _High betweenness centrality (0.275) - this node is a cross-community bridge._
- **Why does `Pendaftaran, NIK/NPWP, TKU, dan Perubahan Data Profil` connect `Registrasi dan Profil` to `Bukti Potong`, `Akses dan Aktivasi`?**
  _High betweenness centrality (0.275) - this node is a cross-community bridge._
- **What connects `Tujuan layanan`, `Larangan pengumpulan rahasia`, `Bahasa dan istilah` to the rest of the system?**
  _140 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Role dan Impersonate` be split into smaller, more focused modules?**
  _Cohesion score 0.09230769230769231 - nodes in this community are weakly interconnected._
- **Should `Bukti Potong` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `e-Faktur` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._