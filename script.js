$(document).ready(function() {
    
    // =================================================================
    // GANTI URL DI BAWAH INI DENGAN URL WEB APP GOOGLE APPS SCRIPT ANDA
    // =================================================================
    const WEB_APP_URL = window.SHEET_URL_GLOBAL;    
    
    let productData = []; // Variabel untuk menyimpan data produk dari Sheets
    
    // --- SETUP AWAL DAN EVENT LISTENERS ---
    
    function initApp() {
        // Set Tanggal Hari Ini & No Transaksi Acak Awal
        const today = new Date().toISOString().slice(0, 10);
        $('#input-tanggal').val(today);
        
        const randomTransNo = 'TRX-' + Math.random().toString(36).substring(2, 10).toUpperCase();
        $('#input-notrans').val(randomTransNo);

        // Event Listeners
        $('.input-form input').on('input change', updateInvoice);
        $('#input-item-body').on('input', '.berat-item, .harga-satuan, .kadar-item', updateInvoice);
        $('#input-item-body').on('change', '.select-kode', fillItemDetails); 
        $('#input-item-body').on('click', '.remove-item', removeItem);
        $('#add-item').on('click', addItemRow);
        $('#cetak-pdf').on('click', handleSaveAndPrint);

        // Panggil fungsi awal: Ambil data, lalu inisiasi tampilan
        fetchProductData().then(() => {
            addItemRow(); 
            updateInvoice();
        }).catch(error => {
            console.error("Inisialisasi Gagal:", error);
            // Tetap jalankan aplikasi meski data produk gagal dimuat (menggunakan data default)
            addItemRow(); 
            updateInvoice();
        });
    }
    
    // --- FUNGSI ASYNCHRONOUS ---

    async function fetchProductData() {
        try {
            const response = await fetch(WEB_APP_URL, { method: 'GET', mode: 'cors' });
            
            // Coba ambil respons sebagai teks, lalu parse JSON
            const text = await response.text();
            
            // Memastikan data yang dikembalikan adalah array
            const data = JSON.parse(text); 
            if (Array.isArray(data)) {
                productData = data;
            } else {
                 throw new Error("Respons bukan array data.");
            }
            console.log('Data Produk berhasil diambil:', productData);
        } catch (error) {
            console.warn("Gagal mengambil data produk melalui GET. Menggunakan data default.");
            // Data Default jika GAGAL mengambil dari Sheets
            productData = [
                { kode: 'CINCIN-001', jenis: 'CINCIN', model: 'Tunangan Elegance', harga: 5220000 },
                { kode: 'GELANG-005', jenis: 'GELANG', model: 'Bangle Rantai', harga: 12500000 },
                { kode: 'KALUNG-002', jenis: 'KALUNG', model: 'Liontin Bunga', harga: 8750000 }
            ];
        }
    }

    // --- FUNGSI UPDATE UI DAN LOGIKA PERHITUNGAN ---

    function updateInvoice() {
        // 1. Update Detail Header Faktur
        const tgl = $('#input-tanggal').val();
        const nama = $('#input-pelanggan').val();
        const noTrans = $('#input-notrans').val();
        
        const dateObj = new Date(tgl);
        const formattedDate = !isNaN(dateObj) ? dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';

        $('#display-tanggal').text(formattedDate);
        $('#display-pelanggan').text(nama);
        $('#display-notrans').text(noTrans);
        $('#display-notrans-header').text(noTrans);

        // 2. Generate Barcode
        if (noTrans) {
             JsBarcode("#barcode-container", noTrans, {
                format: "CODE128",
                displayValue: false,
                height: 30,
                width: 1,
                margin: 0
            });
        }
       
        // 3. Update Tabel Barang (PDF View) & Hitung Total
        updateItemTableAndTotal();
    }
    
    function updateItemTableAndTotal() {
        let grandTotal = 0;
        let invoiceBodyHtml = '';
        
        $('#input-item-body .item-row').each(function() {
            const row = $(this);
            // Ambil dari input tersembunyi
            const jenis = row.find('.jenis-item').val() || '-';
            const model = row.find('.model-item').val() || '-';
            const kode = row.find('.kode-item-hidden').val() || '-';

            // Ambil dari input terlihat
            const kadar = row.find('.kadar-item').val() || '-';
            const berat = parseFloat(row.find('.berat-item').val()) || 0;
            const hargaSatuan = parseFloat(row.find('.harga-satuan').val()) || 0;
            
            const subtotal = hargaSatuan; 
            grandTotal += subtotal;

            // Buat HTML untuk tampilan PDF
            invoiceBodyHtml += `
                <tr>
                    <td>[Foto]</td>
                    <td>${jenis}</td>
                    <td>${model}</td>
                    <td>${kadar}</td>
                    <td>${kode}</td>
                    <td>${berat.toFixed(3)} Gr</td>
                    <td class="harga" data-price="${subtotal}">${formatRupiah(subtotal)}</td>
                </tr>
            `;
        });
        
        // Tampilkan di area PDF
        $('#invoice-body').html(invoiceBodyHtml);

        // Update Total dan Terbilang
        $('.total-harga').text(formatRupiah(grandTotal));
        $('#text-terbilang').text(numberToTextID(grandTotal));
    }

    // --- FUNGSI MANIPULASI ITEM DINAMIS ---

    function addItemRow() {
        let selectOptions = '<option value="">-- Pilih Produk --</option>';
        productData.forEach(p => {
            selectOptions += `<option value="${p.kode}" 
                               data-jenis="${p.jenis}" 
                               data-model="${p.model}" 
                               data-harga="${p.harga}">
                               ${p.jenis} - ${p.model}
                             </option>`;
        });

        const itemHtml = `
            <tr class="item-row">
                <td>
                    <select class="select-kode" style="width:100%;">
                        ${selectOptions}
                    </select>
                    <input type="hidden" class="jenis-item" value="-">
                    <input type="hidden" class="model-item" value="-">
                    <input type="hidden" class="kode-item-hidden" value="-"> 
                </td>
                <td><input type="text" value="8K" class="kadar-item"></td>
                <td><input type="number" value="0.000" step="0.001" class="berat-item"></td>
                <td><input type="number" value="0" class="harga-satuan"></td>
                <td><button class="remove-item">Hapus</button></td>
            </tr>
        `;
        $('#input-item-body').append(itemHtml);
        updateInvoice();
    }

    function fillItemDetails() {
        const row = $(this).closest('.item-row');
        const selectedOption = $(this).find('option:selected');
        
        // Ambil data dari atribut 'data-' di option
        const kode = selectedOption.val();
        const jenis = selectedOption.data('jenis') || '-';
        const model = selectedOption.data('model') || '-';
        const harga = selectedOption.data('harga') || 0;
        
        // 1. Isi Input yang Terlihat (Harga)
        row.find('.harga-satuan').val(harga);
        
        // 2. Isi Input Tersembunyi (PENTING untuk proses data ke PDF/Sheets)
        row.find('.jenis-item').val(jenis);
        row.find('.model-item').val(model);
        row.find('.kode-item-hidden').val(kode); 
        
        updateInvoice();
    }
    
    function removeItem() {
        $(this).closest('tr').remove();
        updateInvoice();
    }

    // --- FUNGSI SAVE & PRINT (Handle) ---

    function handleSaveAndPrint() {
        if ($('#input-pelanggan').val().trim() === '') {
            alert("Nama pelanggan tidak boleh kosong!");
            return;
        }

        // 1. Nonaktifkan input saat proses berjalan
        $('.input-form input, .select-kode, #add-item, .remove-item').attr('disabled', true);
        
        // 2. Simpan Data ke Sheets
        sendDataToSheets().finally(() => {
            // 3. Cetak PDF setelah pengiriman data
            generatePDF();
            
            // 4. Aktifkan kembali input setelah proses selesai (dengan jeda)
            setTimeout(() => {
                $('.input-form input, .select-kode, #add-item, .remove-item').attr('disabled', false);
            }, 2000);
        });
    }

    // --- FUNGSI INTEGRASI SHEETS (ASYNC) ---

    async function sendDataToSheets() {
        const noTrans = $('#input-notrans').val();
        const tgl = $('#input-tanggal').val();
        const namaPelanggan = $('#input-pelanggan').val();
        const totalHarga = parseFloat($('.total-harga').text().replace(/[^0-9]/g, '')) || 0;
        
        let itemDetail = '';
        $('#input-item-body .item-row').each(function(index) {
            const row = $(this);
            const kode = row.find('.kode-item-hidden').val();
            const jenis = row.find('.jenis-item').val();
            const model = row.find('.model-item').val();
            const harga = row.find('.harga-satuan').val();
            itemDetail += `[${index+1}] Kode:${kode}, Jenis:${jenis}, Harga:${harga}. `;
        });

        const formData = new FormData();
        formData.append('tanggal', tgl);
        formData.append('noTrans', noTrans);
        formData.append('namaPelanggan', namaPelanggan);
        formData.append('itemDetail', itemDetail);
        formData.append('totalHarga', totalHarga);
        formData.append('kasir', 'Otomatis Web');

        try {
            const response = await fetch(WEB_APP_URL, {
                method: 'POST',
                body: formData,
                mode: 'no-cors' // Penting untuk localhost
            });
            console.log('Permintaan pengiriman data ke Google Sheets berhasil dikirim.');
            return Promise.resolve();
        } catch (error) {
            console.error('Error saat mengirim data ke Sheets:', error);
            alert('Gagal menyimpan data ke Sheets. Cek konsol browser untuk error.');
            return Promise.reject(error);
        }
    }

    // --- FUNGSI CETAK PDF ---

    function generatePDF() {
        const invoiceElement = document.getElementById('invoice-box');
        const options = {
            margin: 10,
            filename: `Faktur_${$('#input-notrans').val()}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().from(invoiceElement).set(options).save();
    }
    
    // --- FUNGSI UTILITY (FORMATTING) ---

    function formatRupiah(number) {
        return 'Rp ' + (number || 0).toLocaleString('id-ID');
    }

    function numberToTextID(n) {
        // Fungsi terbilang yang akurat sangat kompleks. Kita gunakan placeholder
        if (n === 0) return 'Nol Rupiah';
        return `Rp ${n.toLocaleString('id-ID')} (Terbilang Otomatis Standar)`;
    }

    // Initialize the application
    initApp();
});