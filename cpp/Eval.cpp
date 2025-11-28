#include "Eval.h"

vector<int> load_source_id_list(string data_dir, int source_node_count) {
    assert(source_node_count <= 1000);
    
    vector<int> source_id_list;
    fstream file;
    string source_id_list_file_name = string(getenv("HOME")) + "/graph_binary/" + data_dir + "/source_id_list.txt";
    file.open(source_id_list_file_name, ios::in);
    assert(file.is_open());
    string source_id_str;
    int counter = 0;
    while (getline(file, source_id_str)) {
        source_id_list.push_back(stoi(source_id_str));
        counter++;
        if (counter >= source_node_count) break;
    }
    cout << "source_id count : " << source_id_list.size() << endl;
    file.close();
    return source_id_list;
}

// Graph load_graph(string data_dir) {
//     string file_name = "indexed_edges.txt";
//     bool is_directed = get_is_directed(data_dir);
//     cout << data_dir << endl;
//     string file_path = "/home/tullys2/graph_binary/" + data_dir + "/" + file_name;
//     Graph graph(file_path, is_directed, ' ');
//     return graph;
// }

bool get_is_directed(string data_dir) {
    if (data_dir == "dblp") {
        return false;
    } else if (data_dir == "flickr-growth") {
        return true;
    } else if (data_dir == "livejournal") {
        return false;
    } else if (data_dir == "orkut") {
        return false;
    } else if (data_dir == "web-berkstan") {
        return true;
    } else if (data_dir == "youtube-u-growth") {
        return false;
    } else if (data_dir == "test") {
        return true;
    } else if (data_dir == "test_undirected") {
        return false;
    } else {
        cout << "unknown dataset!!!" << endl;
        return NULL;
    }
}

// void insert_edges(vector<pair<Node*, Node*>>& edges_to_insert, Graph& graph) {
//     bool is_directed = graph.get_is_directed();
//     for (auto itr = edges_to_insert.begin(); itr != edges_to_insert.end(); itr++) {
//         Node* src_node = itr->first;
//         Node* dst_node = itr->second;
//         src_node -> add_edge(dst_node);
//         if (!is_directed) dst_node -> add_edge(src_node);
//     }
//     edges_to_insert.clear();
// }

// exact_ppr, approx_ppr : key is node_id, value is ppr
double calc_ndcg(map<int, double>& exact_ppr, map<int, double>& approx_ppr, int k) {
    // node　−１ indicates the supernode to which the random walk that reached the dangling node will move next.
    if (exact_ppr.count(-1) == 1) exact_ppr.erase(-1);
    if (approx_ppr.count(-1) == 1) approx_ppr.erase(-1);
    vector<pair<int, double>> ordered_approx_ppr = get_ordered_map(approx_ppr);
    vector<int> approx_ranking;
    for (int i = 0; (i < k) && (i < ordered_approx_ppr.size()); i++) approx_ranking.push_back(ordered_approx_ppr[i].first);
    k = min({k, (int)exact_ppr.size()});
    // fill approx_ranking with meaningless nodes (-1) until the size becomes k.
    // note that exact_ppr[-1] == 0
    while (approx_ranking.size() < k) {
        approx_ranking.push_back(-1);
    }
    return calc_dcg(approx_ranking, exact_ppr) / calc_perfect_dcg(exact_ppr, k);
}

double calc_dcg(const vector<int>& approx_ranking, const map<int, double>& exact_ppr) {
    int k = approx_ranking.size();
    double dcg = 0;
    for (int i = 0; i < k; i++) {
        double ppr_val;
        int approx_node_id = approx_ranking[i];
        auto itr = exact_ppr.find(approx_node_id);
        if (itr != exact_ppr.end()) ppr_val = itr -> second;
        else ppr_val = 0;
        dcg += (pow(2, ppr_val) - 1) / log2(i + 2);
    }
    return dcg;
}

double calc_perfect_dcg(const map<int, double>& exact_ppr, int k) {
    vector<pair<int, double>> ppr_vec;
    for(auto itr = exact_ppr.begin(); itr != exact_ppr.end(); ++itr) {
        ppr_vec.push_back(make_pair(itr->first, itr->second));
    }
    sort(ppr_vec.begin(), ppr_vec.end(),
        [](const pair<int, double> &l, const pair<int, double> &r)
        {
            if (l.second != r.second) {
                return l.second > r.second;
            }
            return l.first < r.first;
        });
    assert(k <= ppr_vec.size());
    ppr_vec.erase(ppr_vec.begin() + k, ppr_vec.end());
    
    double perfect_dcg = 0;
    for (int i = 0; i < ppr_vec.size(); i++) {
        perfect_dcg += (pow(2, ppr_vec[i].second) - 1) / log2(i + 2);
    }

    return perfect_dcg;
}

double calc_spearmanr(const map<int, double>& ppr1, const map<int, double>& ppr2, int k) {
    vector<pair<int, double>> ordered_ppr1 = get_ordered_map(ppr1);
    vector<pair<int, double>> ordered_ppr2 = get_ordered_map(ppr2);
    map<int, int> node_id_to_rank;
    for (int rank_suf = 0; rank_suf < ordered_ppr2.size(); rank_suf++) {
        int node_id = ordered_ppr2.at(rank_suf).first;
        node_id_to_rank[node_id] = rank_suf + 1;
    }

    if (k > ppr1.size()) k = ppr1.size();
    vector<int> rank_list_1, rank_list_2;
    int rank1_sum = 0;
    int rank2_sum = 0;
    for (int rank_suf = 0; rank_suf < k; rank_suf++) {
        int rank1 = rank_suf + 1;
        int node_id = ordered_ppr1.at(rank_suf).first;
        if (node_id_to_rank.count(node_id) != 0) {
            int rank2 = node_id_to_rank.at(node_id);
            rank_list_1.push_back(rank1);
            rank1_sum += rank1;
            rank_list_2.push_back(rank2);
            rank2_sum += rank2;
        }
    }
    int size = rank_list_1.size();
    double rank1_ave = (double)rank1_sum / size;
    double rank2_ave = (double)rank2_sum / size;

    double diff_squared_sum1 = 0;
    for (int rank : rank_list_1) {
        diff_squared_sum1 += pow(rank - rank1_ave, 2);
    }
    double std1 = pow(diff_squared_sum1 / size, 0.5);

    double diff_squared_sum2 = 0;
    for (int rank : rank_list_2) {
        diff_squared_sum2 += pow(rank - rank2_ave, 2);
    }
    double std2 = pow(diff_squared_sum2 / size, 0.5);

    double covar_sum = 0;
    for (int suf = 0; suf < size; suf++) {
        covar_sum += (rank_list_1.at(suf) - rank1_ave) * (rank_list_2.at(suf) - rank2_ave);
    }
    double covar = covar_sum / size;


    return covar / (std1 * std2);


    // int rank_dif_squared_sum = 0;
    // int add_count = 0;
    // for (int rank_suf = 0; rank_suf < k; rank_suf++) {
    //     int rank1 = rank_suf + 1;
    //     int node_id = ordered_ppr1.at(rank_suf).first;
    //     if (node_id_to_rank.count(node_id) != 0) {
    //         int rank2 = node_id_to_rank.at(node_id);
    //         rank_dif_squared_sum += pow(rank1 - rank2, 2);
    //         add_count++;
    //     }
    // }
    // return 1 - (double)(6 * rank_dif_squared_sum) / (double)(add_count * (pow(add_count, 2) - 1));
}

double calc_ap_correlation(const map<int, double>& ppr1, const map<int, double>& ppr2) {
    vector<pair<int, double>> ordered_ppr1 = get_ordered_map(ppr1);
    vector<pair<int, double>> ordered_ppr2 = get_ordered_map(ppr2);
    assert(ordered_ppr1.size() > 1);
    
    map<int, int> node_id_to_rank_in_ppr2;
    for (int rank_suf = 0; rank_suf < ordered_ppr2.size(); rank_suf++) {
        int node_id = ordered_ppr2.at(rank_suf).first;
        node_id_to_rank_in_ppr2[node_id] = rank_suf + 1;
    }

    double total_normalized_correct_count = 0;
    int n = 0;
    for (int rank = 2; rank <= ordered_ppr1.size(); rank++) {
        int correct_order_count = 0;
        int node_id = ordered_ppr1.at(rank - 1).first;
        int deal_count = 0;
        for (int focused_rank = 1; focused_rank < rank; focused_rank++) {
            int focused_node_id = ordered_ppr1.at(focused_rank).first;
            if (node_id_to_rank_in_ppr2.count(node_id) == 0 || node_id_to_rank_in_ppr2.count(focused_node_id) == 0) {
                continue;
            } else {
                deal_count++;
                if (node_id_to_rank_in_ppr2.at(focused_node_id) < node_id_to_rank_in_ppr2.at(node_id)) {
                    correct_order_count++;
                }
            }
        }
        if (deal_count == 0) continue;
        else {
            total_normalized_correct_count += (double)correct_order_count / deal_count;
            n++;
        }
    }
    return total_normalized_correct_count * 2 / (n - 1) - 1;
}

double calc_symmetric_ap_correlation(const map<int, double>& ppr1, const map<int, double>& ppr2) {
    return (calc_ap_correlation(ppr1, ppr2) + calc_ap_correlation(ppr2, ppr1)) / 2;
}

vector<pair<int, double>> get_ordered_map(const map<int, double>& m) {
    vector<pair<int, double>> m_vec;
    for(auto itr = m.begin(); itr != m.end(); ++itr) {
        m_vec.push_back({itr->first, itr->second});
    }
    sort(m_vec.begin(), m_vec.end(),
        [](const pair<int, double> &l, const pair<int, double> &r)
        {
            if (l.second != r.second) {
                return l.second > r.second;
            }
            return l.first < r.first;
        });
    
    return m_vec;
}

vector<pair<int, double>> get_ordered_vector(const vector<double>& v) {
    vector<pair<int, double>> ordered_vec;
    int v_size = v.size();
    for(int i = 0; i < v_size; i++) {
        ordered_vec.push_back({i, v.at(i)});
    }
    sort(ordered_vec.begin(), ordered_vec.end(),
        [](const pair<int, double> &l, const pair<int, double> &r)
        {
            if (l.second != r.second) {
                return l.second > r.second;
            }
            return l.first < r.first;
        });
    
    return ordered_vec;
}

map<int, double> get_normalized_map(const map<int, double>& ppr) {
    double total_ppr = 0;
    map<int, double> normalized_ppr;
    for (const auto&[node_id, ppr_val] : ppr) {
        total_ppr += ppr_val;
    }

    for (const auto&[node_id, ppr_val] : ppr) {
        normalized_ppr.emplace(node_id, ppr_val / total_ppr);
    }

    return normalized_ppr;
}

string get_timestamp() {
    time_t t = time(nullptr);
    const tm* localTime = localtime(&t);
    stringstream s;
    s << localTime->tm_year + 1900 << "/";
    // setw(),setfill()で0詰め
    s << setw(2) << setfill('0') << localTime->tm_mon + 1 << "/";
    s << setw(2) << setfill('0') << localTime->tm_mday << " ";
    s << setw(2) << setfill('0') << localTime->tm_hour << ":";
    s << setw(2) << setfill('0') << localTime->tm_min << ":";
    s << setw(2) << setfill('0') << localTime->tm_sec;

    return s.str();
}

void show_timestamp() {
    cout << get_timestamp() << endl;
}

// void remove_edge(Node* src_node, Node* dst_node, bool is_directed) {
//     int tmp_removed_count = src_node -> del_edge(dst_node);
//     assert(tmp_removed_count == 1);
//     if (!is_directed) {
//         tmp_removed_count = dst_node -> del_edge(src_node);
//         assert(tmp_removed_count == 1);
//     }
//     return;
// }

// vector<pair<int, int>> create_edge_list(Graph& graph) {
//     vector<pair<int, int>> edge_list; // undirectedの場合，1方向しか入らない
//     bool is_directed = graph.get_is_directed();
//     int n = graph.node_size();
//     for (int src_id = 0; src_id < n; src_id++) {
//         vector<int> adj_list = graph.get_adj_list(src_id);
//         for (auto itr = adj_list.begin(); itr != adj_list.end(); itr++) {
//             int dst_id = *itr;
//             if (is_directed) {
//                 edge_list.push_back(make_pair(src_id, dst_id));
//             } else {
//                 if (src_id < dst_id) edge_list.push_back(make_pair(src_id, dst_id));
//             }
//         }
//     }
//     return edge_list;
// }

double get_time_in_sec(clock_t start, clock_t end) {
    return (double)(end - start) / CLOCKS_PER_SEC;
}

double get_time_in_sec(clock_t time) {
    return (double)time / CLOCKS_PER_SEC;
}

void set_exact_ppr(string data_dir, map<int, map<int, double>>& exact_ppr, int source_node_count) {
    vector<int> source_id_list = load_source_id_list(data_dir, source_node_count);
    for (int source_id : source_id_list) {
        exact_ppr[source_id];
    }
    fstream file;
    string file_path = string(getenv("HOME")) + "/graph_binary/" + data_dir + "/exact-ppr.txt";
    file.open(file_path, ios::in);
    assert(file.is_open());
    string line, str;
    char splitter = ' ';
    while (getline(file, line)) {
        stringstream ss{line};
        int src_id, dst_id;
        double ppr_val;
        getline(ss, str, splitter);
        src_id = stoi(str);
        getline(ss, str, splitter);
        dst_id = stoi(str);
        getline(ss, str, splitter);
        ppr_val = stod(str);
        if (exact_ppr.count(src_id) == 0) break;
        exact_ppr.at(src_id).emplace(dst_id, ppr_val);
    }
    file.close();
}

double dotProduct(const map<int, double>& v1, const map<int, double>& v2) {
    double dot = 0.0;
    for (auto const&[key, val] : v1) {
        if (v2.count(key) == 1) {
            dot += val * v2.at(key);
        }
    }
    return dot;
}

double l2_norm(const map<int, double>& v) {
    return sqrt(dotProduct(v, v));
}

double l2_norm(vector<double>& v) {
    double dot = 0.0;
    for (double val : v) {
        dot += val * val;
    }
    return sqrt(dot);
}

map<int, double> scalarMultiply(const map<int, double>& v, double scalar) {
    map<int, double> result;
    for(const auto& [key, val] : v) {
        result.emplace(key, val * scalar);
    }
    return result;
}

map<int, double> vectorSubtract(const map<int, double>& v1, const map<int, double>& v2) {
    map<int, double> result = v1;
    for(const auto& [key, val] : v2) {
        result[key] -= val;
        if (result.at(key) == 0.0) result.erase(key);
    }
    return result;
}

map<int, double> normalize(const map<int, double>& v) {
    double n = l2_norm(v);
    if(n == 0.0) {
        throw std::runtime_error("Cannot normalize a zero vector.");
    }
    return scalarMultiply(v, 1.0 / n);
}

// 部分的な直交成分を抽出
// A から B 成分を削除
// return \cdot B = 0
map<int, double> extractPartialOrthogonalComponent(
    const map<int, double>& A,
    const map<int, double>& B)
{
    // ベクトルBを正規化
    map<int, double> B_normalized = normalize(B);

    // AをBに射影
    double projection_length = dotProduct(A, B_normalized);
    map<int, double> projection = scalarMultiply(B_normalized, projection_length);

    // double B_norm = l2_norm(B);
    // double scale = projection_length / B_norm;
    // cout << "Scale of DC: " << scale << endl;

    // 射影を引く
    map<int, double> C = vectorSubtract(A, projection);

    return C;
}

double calc_cosine_similarity(const map<int, double>& v1, const map<int, double>& v2) {
    double v1_norm = l2_norm(v1);
    double v2_norm = l2_norm(v2);
    double dot = dotProduct(v1, v2);
    return dot / (v1_norm * v2_norm);
}

void show_map(const map<int, double> v) {
    for(const auto& [key, val] : v) cout << key << ": " << val << endl;
    cout << endl;
}